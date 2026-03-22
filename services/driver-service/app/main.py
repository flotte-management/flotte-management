from fastapi import FastAPI
from .database import engine # Si vous avez défini engine dans database.py
from . import models

app = FastAPI()

# Cette ligne crée les tables, elle a besoin que models.Base existe
models.Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {"status": "En ligne", "message": "Structure prête !"}