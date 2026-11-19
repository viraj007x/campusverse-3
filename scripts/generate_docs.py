"""Generates the sample campus document corpus used by CampusRAG.

Run:  backend/.venv/Scripts/python.exe scripts/generate_docs.py
Real college PDFs can be dropped into data/docs/ alongside these files.
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DOCS = Path(__file__).resolve().parent.parent / "data" / "docs"
INSTITUTE = "Graphic Era Hill University"

styles = getSampleStyleSheet()
title = ParagraphStyle("T", parent=styles["Title"], fontSize=20, leading=24, spaceAfter=6, textColor=colors.HexColor("#1e1b4b"))
subtitle = ParagraphStyle("ST", parent=styles["Normal"], alignment=TA_CENTER, textColor=colors.HexColor("#475569"), spaceAfter=18)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=14, leading=18, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#312e81"))
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=11.5, leading=15, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#1e293b"))
body = ParagraphStyle("B", parent=styles["BodyText"], fontSize=10, leading=14.5, spaceAfter=6)
bullet = ParagraphStyle("BL", parent=body, leftIndent=14, bulletIndent=4, spaceAfter=3)
small = ParagraphStyle("SM", parent=body, fontSize=9, textColor=colors.HexColor("#64748b"))

TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
)


def P(text):
    return Paragraph(text, body)


def B(*items):
    return [Paragraph(t, bullet, bulletText="•") for t in items]


def table(rows, widths=None):
    t = Table(rows, colWidths=widths)
    t.setStyle(TABLE_STYLE)
    return t


def build(filename, doc_title, blocks):
    path = DOCS / filename
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=doc_title,
        author=INSTITUTE,
    )
    flow = [Paragraph(INSTITUTE, subtitle), Paragraph(doc_title, title), Spacer(1, 6)]
    flow += blocks
    doc.build(flow)
    print(f"generated {path.name}")


def academic_regulations():
    build(
        "Academic_Regulations_And_Attendance.pdf",
        "Academic Regulations and Attendance Policy (B.Tech, R2023)",
        [
            Paragraph("1. Programme Structure", h1),
            P("The B.Tech programme is offered over eight semesters with a total of 168 credits. "
              "Semesters 7 and 8 carry 22 and 18 credits respectively, including the two-phase major project. "
              "A student must earn a minimum of 168 credits to be eligible for the degree."),
            Paragraph("2. Attendance Policy", h1),
            P("Every student must maintain a minimum of <b>75% attendance in each course</b> to be eligible to write the end semester examination. "
              "Attendance is computed course-wise, not as a programme average."),
            *B(
                "Students with attendance between 65% and 75% may apply for condonation with a medical certificate and a condonation fee of Rs. 1,500 per course.",
                "Students below 65% attendance in a course will be detained in that course and must re-register in the supplementary semester without attendance relief.",
                "Medical leave beyond five consecutive days must be submitted to the department office within three working days of rejoining, with hospital records.",
                "Official duty (sports, NSS, paper presentations with HoD approval) is added as attendance only if prior written approval was obtained.",
                "Attendance is published on the campus portal every Friday. Discrepancies must be reported within seven days.",
            ),
            Paragraph("3. Assessment Pattern", h1),
            table(
                [
                    ["Component", "Marks", "Details"],
                    ["Continuous Internal Assessment (CIA)", "40", "Test I (10), Test II (10), Model Exam (10), Assignments and quizzes (10)"],
                    ["End Semester Examination (ESE)", "60", "University-level theory paper of 3 hours, Part A (10 x 2) and Part B (5 x 16)"],
                    ["Project Phase I (CS4081)", "100", "Review 1 (20), Review 2 (30), Final review and report (50), evaluated by a panel"],
                ],
                [62 * mm, 18 * mm, 88 * mm],
            ),
            Spacer(1, 4),
            P("A course is passed when the total (CIA + ESE) is <b>50 or more out of 100</b>. There is no separate minimum in the end semester examination. "
              "Failed courses appear as arrears and may be cleared in the supplementary examination held in February and July."),
            Paragraph("4. Grading", h1),
            table(
                [
                    ["Marks", "Grade", "Grade Points"],
                    ["90 - 100", "O", "10"],
                    ["80 - 89", "A+", "9"],
                    ["70 - 79", "A", "8"],
                    ["60 - 69", "B+", "7"],
                    ["50 - 59", "B", "6"],
                    ["Below 50", "RA (Re-appearance)", "0"],
                ],
                [40 * mm, 45 * mm, 40 * mm],
            ),
            Paragraph("5. Revaluation and Photocopy", h1),
            P("Students may apply for photocopy of the answer script within 7 days of result publication and for revaluation within 10 days. "
              "Revaluation results are final and cannot be challenged further. A revaluation fee of Rs. 400 per paper applies."),
            Paragraph("6. Academic Integrity", h1),
            P("Plagiarism above 20% in assignments, reports, or the project thesis attracts a penalty ranging from mark deduction to course failure. "
              "The major project report must be checked using the institute's Turnitin account before the final review."),
            Paragraph("7. Degree Eligibility", h1),
            *B(
                "Minimum CGPA of 5.0 with no pending arrears at the time of graduation.",
                "Successful completion of the mandatory 6-week industrial internship between semester 6 and 7.",
                "Completion of NPTEL or equivalent MOOC certification for at least one elective.",
            ),
        ],
    )


def examination_manual():
    build(
        "Examination_Manual.pdf",
        "Examination Manual and Malpractice Rules",
        [
            Paragraph("1. Hall Ticket Eligibility", h1),
            P("Hall tickets are issued only to students with at least 75% attendance in every registered course and no outstanding fee dues. "
              "Hall tickets are released on the campus portal 10 days before the first examination."),
            Paragraph("2. Examination Schedule and Conduct", h1),
            *B(
                "Forenoon session: 9:30 AM to 12:30 PM. Afternoon session: 1:30 PM to 4:30 PM.",
                "Students must occupy seats 15 minutes before the session begins. Late entry is permitted only up to 30 minutes after the start.",
                "No student may leave the hall before 60 minutes from the commencement of the examination.",
                "Only transparent pouches, blue or black pens, pencils, and non-programmable calculators are permitted.",
                "Mobile phones, smart watches, and any electronic storage devices are strictly prohibited inside the hall.",
            ),
            Paragraph("3. Question Paper Pattern", h1),
            P("Theory examinations carry 100 marks: Part A has 10 short-answer questions of 2 marks each covering all units, "
              "and Part B has 5 questions of 16 marks each with internal choice (either/or), one per unit. "
              "The pass mark is 50 out of 100 after adding CIA and ESE marks."),
            Paragraph("4. Malpractice and Unfair Means (UFM)", h1),
            table(
                [
                    ["Category", "Example", "Penalty"],
                    ["Category I", "Possession of unauthorised material not used", "Paper cancelled, 1 semester debarment"],
                    ["Category II", "Copying, exchanging slips, talking", "Paper cancelled, 2 semesters debarment"],
                    ["Category III", "Impersonation, leaked question paper, use of devices", "All papers cancelled, 3 semesters debarment and fine"],
                ],
                [30 * mm, 78 * mm, 60 * mm],
            ),
            Spacer(1, 4),
            P("The UFM committee headed by the Controller of Examinations reviews every case and issues a written order within 15 days. "
              "Students may appeal to the Principal within 7 days of the order."),
            Paragraph("5. Results and Supplementary Examinations", h1),
            P("Results are published within 30 days of the last examination. Supplementary examinations are conducted in February for odd semester "
              "arrears and in July for even semester arrears. A student may carry a maximum of four arrears to the next semester."),
            Paragraph("6. Answer Script Access", h1),
            *B(
                "Photocopy applications open 3 days after results and close in 7 days.",
                "Revaluation window closes 10 days after results. Results of revaluation are published within 45 days.",
                "Challenge valuation (re-totalling plus re-evaluation by a third examiner) is available on payment of Rs. 1,000 per paper.",
            ),
        ],
    )


def syllabus():
    build(
        "B_Tech_CSE_Semester_7_Syllabus.pdf",
        "B.Tech Computer Science and Engineering - Semester 7 Syllabus (R2023)",
        [
            Paragraph("Semester 7 - Course Structure", h1),
            table(
                [
                    ["Code", "Course Title", "Credits", "Contact Hours"],
                    ["CS4071", "Deep Learning", "3", "3"],
                    ["CS4072", "Compiler Design", "3", "3"],
                    ["CS4073", "Cloud Computing", "3", "3"],
                    ["CS4074", "Big Data Analytics", "3", "3"],
                    ["CS4075", "Professional Elective - Natural Language Processing", "3", "3"],
                    ["CS4081", "Project Work - Phase I", "6", "12"],
                ],
                [22 * mm, 90 * mm, 20 * mm, 34 * mm],
            ),
            Paragraph("CS4071 Deep Learning", h1),
            P("<b>Course Outcomes:</b> Design feed-forward and convolutional networks, apply sequence models, implement attention mechanisms, "
              "and evaluate models using appropriate metrics."),
            *B(
                "Unit 1 - Neural networks fundamentals: perceptron, backpropagation, activation functions, loss functions, optimizers (SGD, Adam).",
                "Unit 2 - Convolutional networks: convolution, pooling, padding, stride, ResNet, transfer learning.",
                "Unit 3 - Sequence models: RNN, LSTM, GRU, vanishing gradients, sequence-to-sequence models.",
                "Unit 4 - Attention and Transformers: self-attention, multi-head attention, positional encoding, BERT and GPT architectures.",
                "Unit 5 - Generative and deployment: autoencoders, GAN basics, diffusion overview, model compression, ONNX deployment.",
            ),
            Paragraph("CS4073 Cloud Computing", h1),
            P("<b>Course Outcomes:</b> Explain service and deployment models, design scalable architectures, and deploy applications using containers and managed services."),
            *B(
                "Unit 1 - Introduction to cloud computing: NIST definition, IaaS/PaaS/SaaS, public/private/hybrid deployment models, economics of cloud.",
                "Unit 2 - Virtualization: hypervisors, containers versus virtual machines, Docker images and layers, Kubernetes pods and services.",
                "Unit 3 - Cloud storage and databases: object storage, block storage, replication, consistency, CAP theorem, managed SQL and NoSQL.",
                "Unit 4 - Scalability and reliability: load balancing, auto-scaling, serverless computing, fault tolerance, disaster recovery.",
                "Unit 5 - Cloud security and DevOps: IAM, encryption at rest and in transit, CI/CD pipelines, monitoring, cost optimisation.",
            ),
            Paragraph("CS4081 Project Work - Phase I", h1),
            P("Phase I carries 100 marks evaluated through two internal reviews. Students work in teams of up to three. "
              "Deliverables: problem statement and literature survey (Review 1), system design and module implementation (Review 2), "
              "working prototype, IEEE-format report, and a published paper or patent draft as a bonus component."),
            *B(
                "Review 1 (week 6): synopsis, literature survey of at least 15 papers, proposed architecture.",
                "Review 2 (week 11): working modules, dataset description, preliminary results.",
                "Final review (week 15): integrated system, benchmark results, report and demo.",
                "Plagiarism below 15%; reports without Turnitin proof are not accepted.",
            ),
            Paragraph("Recommended Textbooks", h1),
            *B(
                "Deep Learning - Ian Goodfellow, Yoshua Bengio, Aaron Courville, MIT Press.",
                "Cloud Computing: Concepts, Technology and Architecture - Thomas Erl, Pearson.",
                "Speech and Language Processing - Jurafsky and Martin (for the NLP elective).",
            ),
        ],
    )


def placement_policy():
    build(
        "Placement_And_Internship_Policy.pdf",
        "Placement, Internship and Career Development Policy",
        [
            Paragraph("1. Registration and Eligibility", h1),
            P("Final year students must register with the Placement Cell before August 31 of the academic year. "
              "Registration requires an updated resume, a signed code of conduct, and a verified academic record."),
            table(
                [
                    ["Company Category", "Minimum CGPA", "Backlog Rule"],
                    ["Service and consulting companies", "6.5", "No active arrears at the time of interview"],
                    ["Product companies and startups", "7.5", "Zero arrears including history"],
                    ["Core engineering and manufacturing", "6.0", "Maximum one active arrears"],
                ],
                [78 * mm, 30 * mm, 60 * mm],
            ),
            Spacer(1, 4),
            Paragraph("2. One Offer Policy", h1),
            P("A student who accepts an offer must withdraw from further placement drives. Students placed in a dream company (CTC above 10 LPA) "
              "may participate in at most two additional super-dream drives. Reneging an accepted offer results in a placement ban for the student and "
              "may affect the institute's future relationship with the recruiter."),
            Paragraph("3. Internship Requirements", h1),
            *B(
                "A mandatory 6-week internship after semester 6 is a degree requirement. It carries 2 audit credits.",
                "Internship offers must be approved by the department internship coordinator before joining.",
                "Students must submit weekly logs, a completion certificate, and a 10-page report to the department.",
                "Self-arranged internships require a company offer letter on letterhead and an NOC from the HoD.",
            ),
            Paragraph("4. Training Programme", h1),
            P("The Career Development Cell conducts aptitude training from semester 5 and technical training from semester 6. "
              "Attendance in at least 80% of training sessions is mandatory for placement eligibility. "
              "Mock interviews, group discussion practice, and resume clinics are held every alternate Saturday."),
            Paragraph("5. Resume and Interview Guidelines", h1),
            *B(
                "Resume must be one page, in the institute template, PDF format, maximum 100 KB.",
                "Projects must list technologies used, individual contribution, and measurable outcomes.",
                "Do not include photographs, marital status, or unrelated personal details.",
                "Report to every interview in formal attire with two printed resumes and the hall ticket copy.",
                "Maintain a minimum CGPA as stated by each recruiter; the Placement Cell verifies eligibility before every drive.",
            ),
            Paragraph("6. Offer Acceptance and PPO", h1),
            P("Pre-placement offers (PPO) from internship companies are valid if the intern receives a rating of 'exceeds expectations'. "
              "Offer letters must be submitted to the Placement Cell within 7 days of receipt. "
              "Any violation of the code of conduct during a drive may lead to permanent debarment from campus placements."),
        ],
    )


def campus_handbook():
    build(
        "Campus_Handbook_Library_Hostel_And_Services.pdf",
        "Campus Handbook: Library, Hostel, Canteen and Student Services",
        [
            Paragraph("1. Central Library", h1),
            *B(
                "Working hours: 8:00 AM to 10:00 PM on weekdays, 9:00 AM to 5:00 PM on Saturdays. Closed on public holidays.",
                "Students may borrow up to 4 books for 14 days. Faculty may borrow 8 books for 30 days.",
                "Overdue fine is Rs. 5 per book per day. Lost books must be replaced or paid for at 1.5 times the printed price.",
                "Digital access to IEEE Xplore, Springer, DELNET, and NPTEL content is available through the campus WiFi using institute credentials.",
                "The reading hall on the first floor is a silence zone. Group discussion rooms must be booked at the circulation desk.",
            ),
            Paragraph("2. Hostel Rules", h1),
            *B(
                "Gate timing: entry permitted until 9:00 PM. Late entries require warden approval and are logged.",
                "Visitors are allowed in the visitors' lounge between 10:00 AM and 6:00 PM only.",
                "Mess timings: breakfast 7:30-9:00 AM, lunch 12:30-2:00 PM, snacks 5:00-6:00 PM, dinner 7:30-9:00 PM.",
                "Electrical appliances above 100 W, cooking, and loud music are prohibited in rooms.",
                "Overnight absence must be recorded in the register with parent consent.",
            ),
            Paragraph("3. Canteen and Food Court", h1),
            P("The main canteen operates from 7:30 AM to 8:00 PM. The food court near the E-block operates until 9:30 PM. "
              "Digital payments are accepted. Grievances about food quality can be posted on the campus portal or reported to the mess committee."),
            Paragraph("4. Lost and Found", h1),
            P("The Lost and Found desk is located in the Administrative Block, room A-102, and operates from 9:00 AM to 5:00 PM on working days. "
              "Found items must be deposited within 24 hours. Claimants must describe the item and produce their institute ID card. "
              "Unclaimed items are disposed of after 30 days. High-value items such as laptops and phones are handed over to the security office."),
            Paragraph("5. WiFi and IT Services", h1),
            *B(
                "Network SSID: CAMPUSVERSE. Login with your institute email and portal password.",
                "Each student may connect two devices. Bandwidth-heavy downloads between 10 AM and 4 PM are throttled.",
                "Lab systems provide MATLAB, Anaconda, CUDA toolkit, and JetBrains IDEs.",
                "WiFi or portal issues: raise a ticket at the IT helpdesk, ground floor of the library, or email ithelp@kit.edu.",
            ),
            Paragraph("6. Transport", h1),
            P("Institute buses cover 14 routes across the city. Bus fees are payable per semester at the accounts office. "
              "Routes and timings are published on the portal before the start of every semester. Students must carry bus passes at all times."),
            Paragraph("7. Health and Emergencies", h1),
            *B(
                "Medical room: ground floor of the main block, 8:30 AM to 5:30 PM. A doctor visits daily from 10 AM to 12 PM.",
                "Campus security control room: extension 100 (24 hours).",
                "Ambulance and emergency: extension 108.",
                "Anti-ragging helpline: 1800-180-5522. Grievances may be emailed to grievance@kit.edu with complete details.",
            ),
        ],
    )


def academic_calendar():
    build(
        "Academic_Calendar_Odd_Semester_2026-27.pdf",
        "Academic Calendar - Odd Semester 2026-27",
        [
            Paragraph("Important Dates", h1),
            table(
                [
                    ["Event", "Dates"],
                    ["Commencement of classes", "July 22, 2026"],
                    ["Independence Day holiday", "August 15, 2026"],
                    ["First internal test (Test I)", "September 8 - 12, 2026"],
                    ["Vinayaka Chaturthi holiday", "September 14, 2026"],
                    ["Industrial visit window", "September 21 - 26, 2026"],
                    ["Second internal test (Test II)", "October 27 - 31, 2026"],
                    ["Diwali holidays", "November 6 - 9, 2026"],
                    ["Model examination", "November 10 - 14, 2026"],
                    ["Last working day", "November 20, 2026"],
                    ["Study holidays", "November 21 - 24, 2026"],
                    ["End semester examinations", "November 25 - December 12, 2026"],
                    ["Winter break", "December 13, 2026 - January 4, 2027"],
                    ["Results publication", "January 5, 2027"],
                    ["Supplementary examinations", "February 8 - 15, 2027"],
                    ["Even semester begins", "January 19, 2027"],
                ],
                [80 * mm, 80 * mm],
            ),
            Spacer(1, 6),
            P("Attendance is mandatory on all working days including the days before and after declared holidays. "
              "No special leave is granted for travel. The calendar is subject to change; any revision is notified on the campus portal at least seven days in advance."),
            Paragraph("Examination Schedule Notes", h1),
            *B(
                "Hall tickets for the end semester examinations will be released on November 18, 2026.",
                "Practical and project viva voce examinations are scheduled between November 16 and 24, 2026.",
                "Students with attendance below 75% must meet the HoD before November 12, 2026 to avoid detention.",
            ),
        ],
    )


def previous_year_analysis():
    build(
        "Previous_Year_Question_Pattern_Analysis.pdf",
        "Previous Year Question Pattern Analysis (CS4071 and CS4073)",
        [
            Paragraph("How to read this document", h1),
            P("This analysis covers the last four end semester question papers of CS4071 Deep Learning and CS4073 Cloud Computing. "
              "The paper follows the standard pattern: Part A (10 x 2 = 20 marks) and Part B (5 x 16 = 80 marks), with internal choice in each Part B question."),
            Paragraph("CS4071 Deep Learning - Unit Weightage", h1),
            table(
                [
                    ["Unit", "Typical marks", "Frequently asked topics"],
                    ["Unit 1", "18 - 22", "Backpropagation derivation, activation function comparison, Adam versus SGD"],
                    ["Unit 2", "20 - 24", "CNN architecture calculation, transfer learning, ResNet skip connections"],
                    ["Unit 3", "16 - 20", "LSTM gates, vanishing gradients, sequence-to-sequence encoder-decoder"],
                    ["Unit 4", "20 - 26", "Self-attention computation, transformer architecture, BERT versus GPT"],
                    ["Unit 5", "14 - 18", "Autoencoder loss, GAN training instability, model deployment and ONNX"],
                ],
                [16 * mm, 26 * mm, 124 * mm],
            ),
            Spacer(1, 4),
            P("<b>Repeated questions:</b> 'Explain the backpropagation algorithm with a numerical example' appeared in three of the last four papers. "
              "'Compare LSTM and GRU' and 'Explain multi-head self-attention with a diagram' appear almost every year. "
              "Numerical questions on convolution output size (about 6 marks) appear in Part A regularly."),
            Paragraph("CS4073 Cloud Computing - Unit Weightage", h1),
            table(
                [
                    ["Unit", "Typical marks", "Frequently asked topics"],
                    ["Unit 1", "14 - 18", "NIST service models, cloud economics, public versus private cloud"],
                    ["Unit 2", "22 - 26", "Docker layers, Kubernetes architecture, containers versus VMs"],
                    ["Unit 3", "14 - 18", "CAP theorem, consistency models, object storage"],
                    ["Unit 4", "18 - 24", "Auto-scaling policies, load balancing algorithms, serverless case studies"],
                    ["Unit 5", "16 - 20", "IAM best practices, CI/CD pipeline stages, cloud cost optimisation"],
                ],
                [16 * mm, 26 * mm, 124 * mm],
            ),
            Spacer(1, 4),
            P("<b>Repeated questions:</b> 'Explain Kubernetes architecture with a neat diagram' appeared in all four papers. "
              "A 16-mark application question comparing two cloud providers with a scenario is asked every year. "
              "Students should practise designing a three-tier architecture with auto-scaling, as it combines Units 2 and 4."),
            Paragraph("Preparation Strategy", h1),
            *B(
                "Prioritise Unit 4 and Unit 2 for Deep Learning; together they historically carry 40-50 marks.",
                "For Cloud Computing, master Kubernetes and auto-scaling scenarios, which are repeated every year.",
                "Practise at least two numerical problems per unit for Deep Learning; calculations on convolution and attention matrices are common.",
                "Review Part A questions from the previous four papers; roughly 60% repeat with different wording.",
            ),
        ],
    )


def grievance_policy():
    build(
        "Anti_Ragging_And_Student_Grievance_Policy.pdf",
        "Anti-Ragging and Student Grievance Redressal Policy",
        [
            Paragraph("1. Zero Tolerance Policy", h1),
            P("The institute follows a zero tolerance policy towards ragging in any form, as mandated by the UGC Regulations 2009. "
              "Ragging includes any act of physical or mental harassment, discrimination, or intimidation of freshers or juniors."),
            Paragraph("2. Reporting Channels", h1),
            *B(
                "Anti-ragging helpline: 1800-180-5522 (toll free, 24 hours).",
                "Email: antiragging@kit.edu. Complaints may be anonymous but should include date, place, and names where possible.",
                "Physical complaint box outside the Administrative Block and an online form on the campus portal.",
                "Any faculty member or warden must forward a complaint to the committee within 24 hours.",
            ),
            Paragraph("3. Committee and Investigation", h1),
            P("The Anti-Ragging Committee is chaired by the Principal and includes two senior faculty, the warden, a student representative, "
              "and a local police liaison. Every complaint is investigated within 7 working days. The accused is given a fair hearing and may bring a witness."),
            Paragraph("4. Penalties", h1),
            *B(
                "Minor offences: written warning, community service, and counselling.",
                "Serious offences: suspension from hostel and classes, fine up to Rs. 25,000, and withholding of results.",
                "Severe offences: rustication for one to four semesters, debarment from placements, and police action under IPC sections 323 and 506.",
            ),
            Paragraph("5. General Grievances", h1),
            P("Academic grievances (marks, attendance, exam issues) follow the escalation path: faculty concerned, then HoD, then Dean Academics, then Principal. "
              "Non-academic grievances may be filed with the Student Grievance Cell through grievance@kit.edu. "
              "Every grievance receives an acknowledgement within 2 working days and a resolution or hearing date within 10 working days."),
            Paragraph("6. Counselling Support", h1),
            P("A full-time counsellor is available on Tuesdays and Thursdays from 10 AM to 4 PM in room C-204. "
              "Students may also request online counselling sessions through the campus portal. All sessions are confidential."),
        ],
    )


if __name__ == "__main__":
    DOCS.mkdir(parents=True, exist_ok=True)
    academic_regulations()
    examination_manual()
    syllabus()
    placement_policy()
    campus_handbook()
    academic_calendar()
    previous_year_analysis()
    grievance_policy()
    print("done")
