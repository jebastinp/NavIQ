"""Route optimizer using OR-Tools VRP with per-driver start points.

Each driver starts from their own start_lat/start_lng (or the shared depot
if not set). Drivers return to their start point at end of route.
"""
from typing import List, Optional
from pydantic import BaseModel
import math

try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    HAS_ORTOOLS = True
except Exception:
    HAS_ORTOOLS = False


class Depot(BaseModel):
    lat: float
    lng: float


class OrderIn(BaseModel):
    id: str
    customer_name: str
    address: str
    lat: float
    lng: float


class DriverIn(BaseModel):
    id: str
    name: str
    vehicle: str = ""
    capacity: int = 30
    color: str = "#0071e3"
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


class OptimizeRequest(BaseModel):
    depot: Depot  # fallback depot if driver has no start point
    orders: List[OrderIn]
    drivers: List[DriverIn]
    avg_speed_kmh: float = 22.0
    fuel_price_gbp: float = 1.48
    vehicle_kml: float = 9.0
    shift_start: str = "08:00"
    service_minutes_per_stop: int = 4


class StopOut(BaseModel):
    order_id: str
    customer_name: str
    address: str
    lat: float
    lng: float
    sequence: int
    eta_minutes: float
    eta_clock: str


class RouteOut(BaseModel):
    driver_id: str
    driver_name: str
    driver_color: str
    start_lat: float
    start_lng: float
    stops: List[StopOut]
    distance_km: float
    duration_minutes: float


class OptimizeResponse(BaseModel):
    routes: List[RouteOut]
    total_distance_km: float
    baseline_distance_km: float
    distance_saved_km: float
    fuel_saved_litres: float
    fuel_saved_gbp: float
    optimization_time_ms: float = 0.0
    algorithm: str = "or-tools"


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    dlat = lat2r - lat1r
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1r) * math.cos(lat2r) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _format_clock(start: str, minutes: float) -> str:
    h, m = map(int, start.split(":"))
    total = h * 60 + m + int(minutes)
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def _driver_start(d: DriverIn, fallback: Depot) -> tuple:
    """Returns (lat, lng) for a driver's start point."""
    if d.start_lat is not None and d.start_lng is not None:
        return (float(d.start_lat), float(d.start_lng))
    return (float(fallback.lat), float(fallback.lng))


def _nearest_neighbor(req: OptimizeRequest) -> OptimizeResponse:
    """Simple round-robin assignment + nearest-neighbor sequencing per driver."""
    n = len(req.orders)
    if n == 0 or not req.drivers:
        return OptimizeResponse(routes=[], total_distance_km=0, baseline_distance_km=0,
                                distance_saved_km=0, fuel_saved_litres=0, fuel_saved_gbp=0,
                                algorithm="nearest-neighbor")

    num_drivers = len(req.drivers)
    chunks: List[List[int]] = [[] for _ in range(num_drivers)]
    for i in range(n):
        chunks[i % num_drivers].append(i)

    routes: List[RouteOut] = []
    total_km = 0.0
    for di, driver in enumerate(req.drivers):
        start = _driver_start(driver, req.depot)
        idxs = chunks[di]
        if not idxs:
            routes.append(RouteOut(
                driver_id=driver.id, driver_name=driver.name, driver_color=driver.color,
                start_lat=start[0], start_lng=start[1],
                stops=[], distance_km=0, duration_minutes=0,
            ))
            continue
        unvisited = set(idxs)
        cur = start
        ordered: List[int] = []
        while unvisited:
            nxt = min(unvisited, key=lambda j: haversine_km(cur[0], cur[1], req.orders[j].lat, req.orders[j].lng))
            unvisited.remove(nxt)
            ordered.append(nxt)
            cur = (req.orders[nxt].lat, req.orders[nxt].lng)

        stops: List[StopOut] = []
        dist = 0.0
        elapsed = 0.0
        prev = start
        for seq, j in enumerate(ordered, 1):
            o = req.orders[j]
            leg = haversine_km(prev[0], prev[1], o.lat, o.lng)
            dist += leg
            elapsed += (leg / req.avg_speed_kmh) * 60 + req.service_minutes_per_stop
            stops.append(StopOut(
                order_id=o.id, customer_name=o.customer_name, address=o.address,
                lat=o.lat, lng=o.lng, sequence=seq,
                eta_minutes=round(elapsed, 1),
                eta_clock=_format_clock(req.shift_start, elapsed),
            ))
            prev = (o.lat, o.lng)
        dist += haversine_km(prev[0], prev[1], start[0], start[1])
        total_km += dist
        routes.append(RouteOut(
            driver_id=driver.id, driver_name=driver.name, driver_color=driver.color,
            start_lat=start[0], start_lng=start[1],
            stops=stops, distance_km=round(dist, 2), duration_minutes=round(elapsed, 1),
        ))

    baseline = sum(
        2 * haversine_km(req.depot.lat, req.depot.lng, o.lat, o.lng) for o in req.orders
    )
    saved = max(0.0, baseline - total_km)
    litres = (saved / req.vehicle_kml) if req.vehicle_kml > 0 else 0
    return OptimizeResponse(
        routes=routes, total_distance_km=round(total_km, 2),
        baseline_distance_km=round(baseline, 2), distance_saved_km=round(saved, 2),
        fuel_saved_litres=round(litres, 2), fuel_saved_gbp=round(litres * req.fuel_price_gbp, 2),
        algorithm="nearest-neighbor",
    )


def optimize_routes(req: OptimizeRequest) -> OptimizeResponse:
    """Multi-depot VRP: each driver has their own start/end node."""
    if not HAS_ORTOOLS or len(req.orders) < 2 or len(req.drivers) < 1:
        return _nearest_neighbor(req)

    n_vehicles = len(req.drivers)
    n_orders = len(req.orders)

    # Node layout: [driver1_start, driver2_start, ..., order1, order2, ...]
    # First n_vehicles nodes are driver start points (also end points).
    locs: List[tuple] = []
    for d in req.drivers:
        locs.append(_driver_start(d, req.depot))
    for o in req.orders:
        locs.append((o.lat, o.lng))

    n_locs = len(locs)

    def dist_int(i, j):
        return int(haversine_km(locs[i][0], locs[i][1], locs[j][0], locs[j][1]) * 1000)

    matrix = [[dist_int(i, j) for j in range(n_locs)] for i in range(n_locs)]

    # Each vehicle starts and ends at its own depot index
    starts = list(range(n_vehicles))
    ends = list(range(n_vehicles))

    mgr = pywrapcp.RoutingIndexManager(n_locs, n_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(mgr)

    def cb(from_idx, to_idx):
        return matrix[mgr.IndexToNode(from_idx)][mgr.IndexToNode(to_idx)]

    transit_idx = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    # Capacity: each order is 1 unit, depot nodes are 0
    demands = [0] * n_vehicles + [1] * n_orders

    def demand_cb(idx):
        return demands[mgr.IndexToNode(idx)]

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    capacities = [d.capacity for d in req.drivers]
    routing.AddDimensionWithVehicleCapacity(demand_cb_idx, 0, capacities, True, "Capacity")

    # Balance route lengths (so no driver gets all the work)
    routing.AddDimension(transit_idx, 0, 10_000_000, True, "Distance")
    distance_dim = routing.GetDimensionOrDie("Distance")
    distance_dim.SetGlobalSpanCostCoefficient(100)

    search = pywrapcp.DefaultRoutingSearchParameters()
    search.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search.time_limit.seconds = 3  # cap at 3s for snappier UX

    solution = routing.SolveWithParameters(search)
    if not solution:
        return _nearest_neighbor(req)

    routes: List[RouteOut] = []
    total_km = 0.0
    for vid in range(n_vehicles):
        driver = req.drivers[vid]
        start = _driver_start(driver, req.depot)
        idx = routing.Start(vid)
        stops: List[StopOut] = []
        dist = 0.0
        elapsed = 0.0
        seq = 0
        prev_node = mgr.IndexToNode(idx)
        while not routing.IsEnd(idx):
            next_idx = solution.Value(routing.NextVar(idx))
            next_node = mgr.IndexToNode(next_idx)
            leg = matrix[prev_node][next_node] / 1000.0
            dist += leg
            # Order nodes start at index n_vehicles
            if next_node >= n_vehicles:
                seq += 1
                elapsed += (leg / req.avg_speed_kmh) * 60 + req.service_minutes_per_stop
                o = req.orders[next_node - n_vehicles]
                stops.append(StopOut(
                    order_id=o.id, customer_name=o.customer_name, address=o.address,
                    lat=o.lat, lng=o.lng, sequence=seq,
                    eta_minutes=round(elapsed, 1),
                    eta_clock=_format_clock(req.shift_start, elapsed),
                ))
            prev_node = next_node
            idx = next_idx

        total_km += dist
        routes.append(RouteOut(
            driver_id=driver.id, driver_name=driver.name, driver_color=driver.color,
            start_lat=start[0], start_lng=start[1],
            stops=stops, distance_km=round(dist, 2), duration_minutes=round(elapsed, 1),
        ))

    baseline = sum(2 * haversine_km(req.depot.lat, req.depot.lng, o.lat, o.lng) for o in req.orders)
    saved = max(0.0, baseline - total_km)
    litres = (saved / req.vehicle_kml) if req.vehicle_kml > 0 else 0
    return OptimizeResponse(
        routes=routes, total_distance_km=round(total_km, 2),
        baseline_distance_km=round(baseline, 2), distance_saved_km=round(saved, 2),
        fuel_saved_litres=round(litres, 2), fuel_saved_gbp=round(litres * req.fuel_price_gbp, 2),
        algorithm="or-tools",
    )
