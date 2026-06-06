from dotenv import load_dotenv
import os
load_dotenv(dotenv_path=os.path.expanduser("~/task-manager-backend/.env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import tasks
from routers import chat

app = FastAPI(title="Task Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://18.181.247.4:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(tasks.router)
app.include_router(chat.router, prefix="/api")
