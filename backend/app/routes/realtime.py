"""Server-Sent Events endpoint streaming real-time case intelligence to the UI.

Events emitted:
  event: connected     — sent immediately after the stream opens
  event: heartbeat     — comment keep-alive every HEARTBEAT_SECONDS
  event: case_created  — payload mirrors GET /dashboard/recent-incidents items
"""
import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import joinedload

from app.auth.rbac import ALL_ROLES
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.database.postgres import SessionLocal
from app.models.user import User
from app.services.realtime.bus import realtime_bus

router = APIRouter(
    prefix="/realtime",
    tags=["Real-Time Stream"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v2/auth/login")
HEARTBEAT_SECONDS = 15


def authenticate_sse_user(token: str = Depends(oauth2_scheme)) -> str:
    """Authenticate SSE user and immediately release the DB connection.

    FastAPI keeps dependency generator contexts (like get_db) open for the entire
    lifetime of a StreamingResponse. Using an isolated SessionLocal that is explicitly
    closed in a finally block ensures long-lived SSE connections hold zero pooled DB
    connections, preventing QueuePool exhaustion (503 Service Unavailable).
    """
    try:
        payload = decode_token(token)
    except ValueError:
        raise UnauthorizedException("Invalid or expired token")

    if payload.get("type") != "access":
        raise UnauthorizedException("Provided token is not an access token")

    db = SessionLocal()
    try:
        from app.services.auth_service import is_jti_revoked
        if is_jti_revoked(db, payload.get("jti")):
            raise UnauthorizedException("Token has been revoked")

        username = payload.get("sub")
        user = db.query(User).options(joinedload(User.role)).filter(User.username == username).first()
        if user is None or not user.is_active:
            raise UnauthorizedException("User not found or inactive")
        if user.role.name not in ALL_ROLES:
            raise ForbiddenException(f"Role '{user.role.name}' is not permitted to access realtime stream")
        return user.username
    finally:
        db.close()


async def _event_stream(request: Request, username: str):
    subscriber_id, queue = realtime_bus.subscribe()
    try:
        connected = json.dumps({"status": "connected", "user": username})
        yield f"event: connected\ndata: {connected}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
                continue
            data = json.dumps(event["data"], default=str)
            yield f"event: {event['type']}\ndata: {data}\n\n"
    finally:
        realtime_bus.unsubscribe(subscriber_id)


@router.get("/events")
async def stream_events(
    request: Request,
    username: str = Depends(authenticate_sse_user),
):
    """Long-lived SSE stream of real-time platform events for the current user."""
    return StreamingResponse(
        _event_stream(request, username),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
