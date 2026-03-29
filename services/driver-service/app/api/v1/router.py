from fastapi import APIRouter

from app.api.v1.endpoints.drivers import router as drivers_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(drivers_router)