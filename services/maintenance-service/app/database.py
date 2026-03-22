from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from decouple import config

DATABASE_URL = (
    f"postgresql://{config('DB_USER', default='postgres')}:"
    f"{config('DB_PASSWORD', default='secret')}@"
    f"{config('DB_HOST', default='localhost')}:"
    f"{config('DB_PORT', default='5432')}/"
    f"{config('DB_NAME', default='drivers_db')}"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()