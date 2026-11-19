from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    roll_no: str | None = None
    department: str = "Computer Science"
    semester: int = 7


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: str
    roll_no: str | None = None
    semester: int | None = None

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: int
    code: str
    title: str
    semester: int
    faculty_name: str | None = None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    agent: str = "samvit"


class Source(BaseModel):
    doc_id: str
    title: str
    page: int | None = None
    snippet: str
    score: float


class SessionOut(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    is_active: bool
    challenge: str
    require_liveness: bool
    started_at: datetime
    present_count: int = 0


class AttendanceRecordOut(BaseModel):
    student_id: int
    student_name: str
    roll_no: str | None = None
    confidence: float
    liveness_verified: bool
    created_at: datetime


class FaceEnrollRequest(BaseModel):
    images: list[str]  # base64 data URLs


class FrameRequest(BaseModel):
    image: str  # base64 data URL
    require_liveness: bool | None = None


class StartSessionRequest(BaseModel):
    course_id: int
    require_liveness: bool = True


class CrowdRequest(BaseModel):
    image: str
    zone: str = "Central Library"


class LostFoundCreate(BaseModel):
    kind: str = Field(pattern="^(lost|found)$")
    title: str = Field(min_length=2, max_length=140)
    description: str = ""
    category: str = "Other"
    location: str = ""


class LostFoundOut(BaseModel):
    id: int
    kind: str
    title: str
    description: str
    category: str
    location: str
    status: str
    image_url: str | None = None
    reporter_name: str
    created_at: datetime


class JobMatchRequest(BaseModel):
    jd_title: str = Field(min_length=2, max_length=160)
    jd_text: str = Field(min_length=40)


class InterviewStartRequest(BaseModel):
    role_title: str = Field(min_length=2, max_length=160)


class InterviewAnswerRequest(BaseModel):
    interview_id: int
    answer: str
