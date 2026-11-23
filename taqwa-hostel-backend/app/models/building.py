"""Building and Portion models.

A hostel has 1 or more buildings; a building may have 0 or more
portions. Portion is optional: a hostel without portions simply has
rooms directly under the building.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.core.database import Base


class Building(Base):
    """A building inside a hostel, e.g. Building 1."""

    __tablename__ = "buildings"
    __table_args__ = (UniqueConstraint("hostel_id", "name", name="uq_building_hostel_name"),)

    id = Column(Integer, primary_key=True, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Portion(Base):
    """A portion inside a building. Optional."""

    __tablename__ = "portions"
    __table_args__ = (UniqueConstraint("building_id", "name", name="uq_portion_building_name"),)

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
