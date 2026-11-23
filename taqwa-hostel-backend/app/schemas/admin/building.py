"""Admin schemas for buildings, portions, rooms, and seats."""

from datetime import date

from pydantic import BaseModel, Field

from app.models.room import RoomType


class BuildingCreate(BaseModel):
    """Create a building."""

    name: str = Field(min_length=1, max_length=200)


class PortionCreate(BaseModel):
    """Create a portion inside a building. Portion is optional."""

    name: str = Field(min_length=1, max_length=200)


class RoomCreate(BaseModel):
    """Create a room. Seats are auto-created from room_type (2/3/4)."""

    room_number: str = Field(min_length=1, max_length=50)
    room_type: RoomType
    portion_id: int | None = Field(default=None)


class RoomCreateFlexible(BaseModel):
    """Create a room with an OPTIONAL building.

    When building_id is blank: if exactly one building exists it is
    used; when no building exists a "Main Building" is auto-created
    and used. (When several buildings exist, a building is required.)
    """

    room_number: str = Field(min_length=1, max_length=50)
    room_type: RoomType
    building_id: int | None = Field(default=None)
    portion_id: int | None = Field(default=None)


class RoomUpdate(BaseModel):
    """Edit a room: number, type and/or portion. No floor field."""

    room_number: str | None = Field(default=None, min_length=1, max_length=50)
    room_type: RoomType | None = None
    portion_id: int | None = None


class BuildingResponse(BaseModel):
    """A building row."""

    id: int
    hostel_id: int
    name: str


class RoomResponse(BaseModel):
    """A room row."""

    id: int
    building_id: int
    portion_id: int | None
    room_number: str
    room_type: str


class SeatResponse(BaseModel):
    """A seat row."""

    id: int
    room_id: int
    seat_label: str
    status: str


class DashboardResponse(BaseModel):
    """Admin dashboard counts."""

    total_residents: int
    total_seats: int
    vacant_seats: int
    occupied_seats: int
    total_buildings: int
    total_rooms: int
