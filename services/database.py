from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Vérifiez bien votre mot de passe ici
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:secret@localhost:5432/drivers_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Pour l'injection de dépendance dans les routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()