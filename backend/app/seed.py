from datetime import datetime, timedelta

from .db import SessionLocal
from .models import (
    Assignment,
    AttendanceRecord,
    AttendanceSession,
    ChatLog,
    Course,
    CrowdSample,
    Enrollment,
    Submission,
    User,
)
from .security import hash_password


DEMO_USERS = [
    ("Dr. Meera Krishnan", "admin@campus.edu", "Admin@123", "admin", "Administration", None, None),
    ("Dr. Arjun Raman", "faculty@campus.edu", "Faculty@123", "faculty", "Computer Science", None, None),
    ("Dr. Divya Nair", "divya@campus.edu", "Faculty@123", "faculty", "Computer Science", None, None),
    ("Aarav Sharma", "student@campus.edu", "Student@123", "student", "Computer Science", "23CS101", 7),
    ("Diya Patel", "diya@campus.edu", "Student@123", "student", "Computer Science", "23CS102", 7),
    ("Rohan Verma", "rohan@campus.edu", "Student@123", "student", "Computer Science", "23CS103", 7),
    ("Sneha Iyer", "sneha@campus.edu", "Student@123", "student", "Computer Science", "23CS104", 7),
    ("Kabir Singh", "kabir@campus.edu", "Student@123", "student", "Computer Science", "23CS105", 7),
    ("Ananya Rao", "ananya@campus.edu", "Student@123", "student", "Computer Science", "23CS106", 7),
]

COURSES = [
    ("CS4071", "Deep Learning", 7, 0),
    ("CS4072", "Compiler Design", 7, 1),
    ("CS4073", "Cloud Computing", 7, 0),
    ("CS4081", "Project Work - Phase I", 7, 0),
]

SEED_SESSIONS = [
    # (course_index, days_ago, hour, present_student_indexes)
    (0, 9, 9, [0, 1, 2, 3, 4, 5]),
    (0, 7, 10, [0, 1, 2, 3, 4]),
    (0, 5, 11, [0, 1, 2, 4, 5]),
    (1, 8, 14, [0, 1, 2, 5]),
    (1, 6, 9, [0, 1, 3, 4]),
    (2, 9, 11, [0, 1, 2, 3, 4, 5]),
    (2, 6, 15, [0, 1, 2, 3]),
    (2, 2, 10, [1, 2, 4, 5]),
]

SEED_QUESTIONS = [
    ("What is the attendance requirement for the end semester exam?", "You need a minimum of 75% attendance in each course to be eligible, and condonation is possible between 65% and 75% with a medical certificate."),
    ("When do the end semester exams start this semester?", "The end semester examinations run from November 25 to December 12, 2026, with study holidays from November 21 to 24."),
    ("What CGPA do I need for product company placements?", "Product companies and startups require a minimum CGPA of 7.5 with zero arrears including history."),
    ("How many books can I borrow from the library?", "Students may borrow up to 4 books for 14 days, and the overdue fine is Rs. 5 per book per day."),
    ("What are the penalties for malpractice in exams?", "Penalties are graded as Category I to III, from one semester debarment up to three semesters with a fine for impersonation or using devices."),
    ("Explain the assessment pattern for theory courses.", "Theory courses carry 40 marks of continuous internal assessment and 60 marks for the end semester examination, with a pass mark of 50 out of 100."),
    ("Which units are most important for CS4071 Deep Learning?", "Unit 4 (attention and transformers) and Unit 2 (CNNs) historically carry the most marks, roughly 40 to 50 marks combined."),
    ("What is the one offer policy during placements?", "Once you accept an offer you must withdraw from further drives; only dream companies above 10 LPA allow up to two additional super-dream drives."),
    ("Where is the lost and found desk?", "The Lost and Found desk is in the Administrative Block, room A-102, open 9 AM to 5 PM on working days."),
    ("When is the model examination?", "The model examination is scheduled from November 10 to 14, 2026."),
    ("How do I apply for revaluation?", "Apply within 10 days of result publication with a fee of Rs. 400 per paper; photocopy requests open 3 days after results."),
    ("What is the hostel in-time?", "Hostel entry is permitted until 9 PM; late entries need warden approval and are logged."),
    ("Tell me about the Docker and Kubernetes portion in Cloud Computing.", "Unit 2 covers containers versus virtual machines, Docker layers, and Kubernetes pods and services in detail."),
    ("What is the internship requirement for my degree?", "A mandatory 6-week internship after semester 6 with weekly logs, a completion certificate and a 10-page report."),
]

SEED_SOURCES = {
    0: ["Academic Regulations and Attendance Policy (B.Tech, R2023)"],
    1: ["Academic Calendar - Odd Semester 2026-27"],
    2: ["Placement, Internship and Career Development Policy"],
    3: ["Campus Handbook: Library, Hostel, Canteen and Student Services"],
    4: ["Examination Manual and Malpractice Rules"],
    5: ["Academic Regulations and Attendance Policy (B.Tech, R2023)"],
    6: ["Previous Year Question Pattern Analysis (CS4071 and CS4073)"],
    7: ["Placement, Internship and Career Development Policy"],
    8: ["Campus Handbook: Library, Hostel, Canteen and Student Services"],
    9: ["Academic Calendar - Odd Semester 2026-27"],
    10: ["Examination Manual and Malpractice Rules"],
    11: ["Campus Handbook: Library, Hostel, Canteen and Student Services"],
    12: ["B.Tech Computer Science and Engineering - Semester 7 Syllabus (R2023)"],
    13: ["Placement, Internship and Career Development Policy"],
}


TRANSFORMERS_REFERENCE = (
    "A transformer replaces recurrence with self-attention. The encoder stacks multi-head attention with "
    "feed-forward layers, residual connections and layer normalisation. Scaled dot-product attention computes "
    "query-key compatibility divided by the square root of the key dimension. Positional encodings inject token "
    "order. The decoder uses masked self-attention to preserve causality and cross-attention over encoder states. "
    "Training uses teacher forcing and label-smoothed cross entropy; generation is autoregressive. Compared with "
    "recurrent networks, transformers parallelise over sequence positions, cutting GPU training time, but attention "
    "memory grows quadratically with sequence length; sparse and linear attention variants mitigate this. "
    "Pretraining followed by fine-tuning achieves strong NLP results."
)

AARAV_ESSAY = (
    "Transformers replaced recurrence with self-attention. The encoder stacks multi-head attention blocks with "
    "feed-forward networks, residual connections and layer normalisation. Scaled dot-product attention computes "
    "the query-key compatibility divided by the square root of the key dimension, which keeps gradients stable. "
    "Positional encodings inject token order because attention itself is permutation invariant. The decoder uses "
    "masked self-attention to preserve causality and cross-attention over the encoder states. Training relies on "
    "teacher forcing and label-smoothed cross entropy, while generation is autoregressive. Compared with recurrent "
    "networks, transformers parallelise over sequence positions and cut GPU training time, but attention memory "
    "grows quadratically with sequence length; sparse and linear attention variants mitigate this cost. Pretraining "
    "on large corpora followed by task-specific fine-tuning achieves strong NLP results."
)

DIYA_PARAPHRASE = (
    "Rather than processing tokens sequentially like recurrent networks, the transformer architecture is built on "
    "self-attention. Each encoder layer combines multi-head attention with a feed-forward network, using residual "
    "connections and layer normalisation. The scaled dot-product attention mechanism computes query-key products "
    "divided by the square root of the key dimension, and positional encodings provide information about token "
    "order. Multiple attention heads allow the model to focus on different representation subspaces. In the decoder, "
    "masked self-attention preserves causality while cross-attention conditions generation on the encoder output. "
    "Models are trained with teacher forcing and label smoothing, and generation is autoregressive. In contrast to "
    "recurrent networks, transformers parallelise over sequence positions, reducing GPU training time, although "
    "attention memory grows quadratically with sequence length; sparse and linear attention variants address this "
    "limitation. Pretraining followed by fine-tuning yields strong NLP benchmarks."
)

ROHAN_AI_TEXT = (
    "In today's rapidly evolving landscape of artificial intelligence, transformer architectures have emerged as a "
    "transformative paradigm for natural language processing. It is important to note that these models leverage "
    "self-attention mechanisms to capture complex dependencies within sequential data. Furthermore, multi-head "
    "attention enables the model to attend to information from different representation subspaces simultaneously. "
    "Additionally, residual connections and layer normalisation are crucial for stable and efficient training. "
    "Moreover, positional encodings play a vital role in preserving the order of tokens, and masked attention in the "
    "decoder ensures autoregressive generation. Consequently, transformers offer significant advantages in terms of "
    "parallelisation and scalability compared to traditional recurrent networks. However, it is worth noting that "
    "the quadratic complexity of self-attention poses challenges for long sequences. In conclusion, transformers "
    "represent a comprehensive and robust foundation for modern natural language processing systems."
)

SNEHA_ESSAY = (
    "Transformers use attention instead of recurrence. Self-attention lets every token look at every other token, "
    "and multi-head attention runs several attention functions in parallel. The encoder has attention and "
    "feed-forward layers with residual connections and layer norm. The decoder adds masked attention so predictions "
    "only use earlier tokens, plus cross-attention to read the encoder. Positional encodings give the model word "
    "order information. Because computation is parallel, training is faster than with LSTMs, though memory cost "
    "grows with sequence length. Pretraining on large text and fine-tuning gives good results for translation and "
    "classification."
)

DOCKER_REFERENCE = (
    "Virtual machines emulate hardware and each runs a full guest operating system through a hypervisor, so boot "
    "times and memory overhead are high while isolation is strong. Containers share the host kernel and package an "
    "application with its dependencies, giving faster startup, lower overhead and higher density. Docker uses "
    "images, layers and a union filesystem; Kubernetes orchestrates containers with pods, services and replica "
    "sets. Operational trade-offs include weaker isolation than VMs, image supply-chain security and stateful "
    "workloads needing volumes."
)


def seed_eval_demo() -> None:
    """Demo assignments and submissions (one paraphrased, one AI-flavoured) for the EvalAI portal."""
    db = SessionLocal()
    try:
        if db.query(Assignment).count() > 0:
            return
        by_email = {u.email: u for u in db.query(User).all()}
        faculty = by_email.get("faculty@campus.edu")
        courses = {c.code: c for c in db.query(Course).all()}
        if not faculty or "CS4071" not in courses:
            return

        transformer = Assignment(
            course_id=courses["CS4071"].id,
            faculty_id=faculty.id,
            title="Transformers vs Recurrence — concept review",
            prompt=(
                "Write a 150-250 word technical review of the transformer architecture. Explain self-attention, "
                "positional encoding, the encoder-decoder structure and one training or efficiency consideration. "
                "Ground the answer in the Unit 4 notes."
            ),
            reference=TRANSFORMERS_REFERENCE,
            rubric=[
                {"criterion": "Concept accuracy", "max": 5, "description": "Self-attention, positional encoding, encoder-decoder correctness"},
                {"criterion": "Technical depth", "max": 3, "description": "Training objective, efficiency trade-offs, concrete detail"},
                {"criterion": "Clarity", "max": 2, "description": "Clear structure, precise terminology, readable flow"},
            ],
            max_marks=10,
        )
        docker = Assignment(
            course_id=courses["CS4073"].id,
            faculty_id=faculty.id,
            title="Docker containers vs virtual machines — case study",
            prompt=(
                "Compare containers and virtual machines for a campus portal deployment. Cover isolation, overhead, "
                "startup time and orchestration, and recommend an approach for a 3-tier web application."
            ),
            reference=DOCKER_REFERENCE,
            rubric=[
                {"criterion": "Comparison accuracy", "max": 5, "description": "Hypervisor vs shared kernel, isolation and overhead"},
                {"criterion": "Operational reasoning", "max": 3, "description": "Docker images, Kubernetes, security and stateful workloads"},
                {"criterion": "Recommendation", "max": 2, "description": "Justified recommendation for the scenario"},
            ],
            max_marks=10,
        )
        db.add_all([transformer, docker])
        db.commit()
        db.refresh(transformer)
        db.refresh(docker)

        now = datetime.utcnow()
        demos = [
            ("student@campus.edu", "aarav_transformers.txt", AARAV_ESSAY, 3),
            ("diya@campus.edu", "diya_transformers.txt", DIYA_PARAPHRASE, 2),
            ("rohan@campus.edu", "rohan_transformers.txt", ROHAN_AI_TEXT, 1),
            ("sneha@campus.edu", "sneha_transformers.txt", SNEHA_ESSAY, 5),
        ]
        for email, filename, body, hours_ago in demos:
            student = by_email.get(email)
            if not student:
                continue
            db.add(
                Submission(
                    assignment_id=transformer.id,
                    student_id=student.id,
                    filename=filename,
                    text=body,
                    status="submitted",
                    created_at=now - timedelta(hours=hours_ago),
                )
            )
        db.commit()
        print("Seeded EvalAI demo: 2 assignments, 4 submissions")
    finally:
        db.close()


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return
        users: list[User] = []
        for name, email, password, role, dept, roll, sem in DEMO_USERS:
            u = User(
                name=name,
                email=email,
                password_hash=hash_password(password),
                role=role,
                department=dept,
                roll_no=roll,
                semester=sem,
            )
            db.add(u)
            users.append(u)
        db.commit()
        for u in users:
            db.refresh(u)

        faculty1, faculty2 = users[1], users[2]
        students = users[3:9]

        courses: list[Course] = []
        for code, title, sem, faculty_idx in COURSES:
            c = Course(
                code=code,
                title=title,
                semester=sem,
                faculty_id=faculty1.id if faculty_idx == 0 else faculty2.id,
            )
            db.add(c)
            courses.append(c)
        db.commit()
        for c in courses:
            db.refresh(c)
            for s in students:
                db.add(Enrollment(course_id=c.id, student_id=s.id))
        db.commit()

        now = datetime.utcnow()
        for course_idx, days_ago, hour, present_idxs in SEED_SESSIONS:
            course = courses[course_idx]
            faculty = db.get(User, course.faculty_id)
            start = (now - timedelta(days=days_ago)).replace(hour=hour, minute=5, second=0, microsecond=0)
            session = AttendanceSession(
                course_id=course.id,
                faculty_id=faculty.id,
                is_active=False,
                challenge="done",
                require_liveness=True,
                started_at=start,
                ended_at=start + timedelta(hours=1),
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            for idx in present_idxs:
                db.add(
                    AttendanceRecord(
                        session_id=session.id,
                        student_id=students[idx].id,
                        confidence=0.82 + 0.03 * (idx % 4),
                        liveness_verified=True,
                        created_at=start + timedelta(minutes=4 + idx),
                    )
                )
        db.commit()

        zones = {
            "Central Library": lambda h: max(4, 34 - abs(17 - h) * 3),
            "Main Canteen": lambda h: max(2, 55 - abs(13 - h) * 6),
            "E-Block Food Court": lambda h: max(1, 26 - abs(15 - h) * 4),
        }
        for zone, fn in zones.items():
            for hours_ago in range(36, -1, -1):
                ts = now - timedelta(hours=hours_ago)
                if 0 <= ts.hour <= 22:
                    jitter = ((hours_ago * 7 + int(zone[0].encode()[0])) % 5) - 2
                    db.add(CrowdSample(zone=zone, person_count=max(0, fn(ts.hour) + jitter), created_at=ts))
        db.commit()

        for i, (question, answer) in enumerate(SEED_QUESTIONS):
            src_title = SEED_SOURCES.get(i, ["Academic Regulations and Attendance Policy (B.Tech, R2023)"])[0]
            db.add(
                ChatLog(
                    user_id=students[i % len(students)].id,
                    question=question,
                    answer=answer,
                    sources=[{"doc_id": "seed", "title": src_title, "page": 1 + (i % 4), "snippet": answer[:180], "score": 0.03}],
                    mode="groq" if i % 4 else "offline",
                    latency_ms=650 + (i * 137) % 900,
                    created_at=now - timedelta(days=(i % 9), hours=(i * 3) % 20),
                )
            )
        db.commit()
        print("Seeded demo data: users, courses, attendance history, crowd samples, chat logs")
    finally:
        db.close()
