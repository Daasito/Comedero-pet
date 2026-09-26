from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime, timedelta
import uuid

app = FastAPI(title="API Comedero IoT")

# Permite peticiones desde el frontend web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base de datos simulada en memoria
devices_status: Dict[str, datetime] = {}
commands_db: Dict[str, dict] = {}

class FeedRequest(BaseModel):
    device_id: str
    duration_seconds: int

class StatusUpdateRequest(BaseModel):
    status: str  # "served" o "failed"

# --- Endpoints para la Web ---

@app.post("/api/v1/feed")
def create_feed_command(req: FeedRequest):
    command_id = str(uuid.uuid4())[:8]
    command = {
        "id": command_id,
        "device_id": req.device_id,
        "duration_seconds": req.duration_seconds,
        "status": "pending"
    }
    commands_db[command_id] = command
    return command

@app.get("/api/v1/devices/{device_id}/status")
def get_device_status(device_id: str):
    last_seen = devices_status.get(device_id)
    if last_seen and (datetime.now() - last_seen) < timedelta(seconds=30):
        return {"status": "online"}
    return {"status": "offline"}

@app.get("/api/v1/commands/{command_id}")
def get_command_status(command_id: str):
    command = commands_db.get(command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Comando no encontrado")
    return command

# --- Endpoints para el ESP32 ---

@app.get("/api/v1/devices/{device_id}/pending")
def get_pending_command(device_id: str):
    # El ESP32 consulta si hay tareas pendientes y reporta su presencia
    devices_status[device_id] = datetime.now()
    for cmd in commands_db.values():
        if cmd["device_id"] == device_id and cmd["status"] == "pending":
            return {"has_command": True, "command": cmd}
    return {"has_command": False}

@app.patch("/api/v1/commands/{command_id}")
def update_command_status(command_id: str, req: StatusUpdateRequest):
    if command_id not in commands_db:
        raise HTTPException(status_code=404, detail="Comando no encontrado")
    commands_db[command_id]["status"] = req.status
    return commands_db[command_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)