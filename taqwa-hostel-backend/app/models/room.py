"""Room and Seat models.

Room number is text set by the admin (e.g. "111") and unique per
building. When a room is created, seats are auto-created from its
room type: 2, 3, or 4 seats.
"""

import enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.core.database import Base


class RoomType(str, enum.Enum):
    """Room size by number of seats."""

    TWO_SEATER = "2-seater"
    THREE_SEATER = "3-seater"
    FOUR_SEATER = "4-seater"


ROOM_SEAT_COUNT = {
    RoomType.TWO_SEATER.value: 2,
    RoomType.THREE_SEATER.value: 3,
    RoomType.FOUR_SEATER.value: 4,
}


class SeatStatus(str, enum.Enum):
    """Whether a seat is free, taken, or blocked by the admin."""

    VACANT = "vacant"
    OCCUPIED = "occupied"
    BLOCKED = "blocked"


class Room(Base):
    """A room inside a building (and optionally a portion)."""

    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("building_id", "room_number", name="uq_room_building_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False, index=True)
    portion_id = Column(Integer, ForeignKey("portions.id"), nullable=True, index=True)
    room_number = Column(String(50), nullable=False)
    room_type = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Seat(Base):
    """One bed/seat inside a room."""

    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    seat_label = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default=SeatStatus.VACANT.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
