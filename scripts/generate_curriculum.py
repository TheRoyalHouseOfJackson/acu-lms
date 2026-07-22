"""
ACU Curriculum Generator
========================
Generates a complete, professionally-structured curriculum for all 38 ACU
degree programs, including per-course lesson outlines and 15-question final
exams. Writes directly into the SQLite database used by the ACU LMS.

Design:
  - Each discipline has a POOL of courses (title + description + lesson set + exam question bank).
  - Each program is a composition of a shared CORE block + a discipline-specific block.
  - Bachelor's = 14 courses, Master's = 12, Doctoral = 8, Dual = 12.
  - Every course gets 5 lessons and one 15-question final exam.

This is a deterministic generator — running it twice produces identical content
(courses/lessons/quizzes for a program are cleared before re-insertion).
"""

import sqlite3
import json
import time
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data.db"

# ---------------------------------------------------------------------------
# COURSE POOLS — organized by discipline. Each course is (title, description).
# Lessons and exam banks are generated in the helpers below.
# ---------------------------------------------------------------------------

CORE_FOUNDATION = [
    ("Introduction to the Bible",
     "Overview of the biblical canon, its structure, historical development, and the storyline of Scripture from Genesis to Revelation. Introduces principles of reverent study and the doctrine of biblical authority."),
    ("Old Testament Survey",
     "A book-by-book survey of the Old Testament covering historical setting, literary genre, major themes, and theological contribution to the redemptive narrative."),
    ("New Testament Survey",
     "A book-by-book survey of the New Testament tracing the life of Christ, the birth of the Church, apostolic mission, and the consummation of God's kingdom."),
    ("Christian Doctrine I: God, Christ, and Scripture",
     "Foundational systematic theology covering the doctrine of God, the person and work of Jesus Christ, revelation, and the authority of Scripture."),
    ("Christian Doctrine II: Salvation, Church, and Last Things",
     "Continued systematic theology addressing soteriology, ecclesiology, pneumatology, and eschatology from an evangelical, Spirit-empowered perspective."),
    ("Spiritual Formation and Discipleship",
     "Practices and disciplines that shape Christlike character — prayer, fasting, Scripture meditation, community, and the fruit of the Spirit — with attention to the minister's inner life."),
    ("Church History Survey",
     "The story of the Church from Pentecost to the present, including the Patristic era, medieval Christianity, the Reformation, revival movements, and modern global Christianity."),
    ("Hermeneutics: Interpreting Scripture",
     "The science and art of biblical interpretation — genre analysis, historical-grammatical method, and responsible application in preaching, teaching, and counseling."),
]

CORE_MINISTRY = [
    ("Practical Ministry Foundations",
     "The theology and practice of Christian ministry — call, character, competence, and cultural context — with case studies from urban and multicultural congregations."),
    ("Homiletics: Preaching the Word",
     "The preparation and delivery of biblically faithful, culturally engaged sermons, including exegesis, sermon architecture, and Spirit-empowered proclamation."),
    ("Worship, Sacraments, and Liturgy",
     "The theology of Christian worship, the meaning and administration of baptism and Communion, and worship planning across traditions."),
    ("Church Administration and Governance",
     "Nonprofit governance, bylaws, board relations, financial stewardship, and legal considerations for local church leaders."),
]

BIBLICAL_STUDIES = [
    ("Pentateuch",
     "In-depth study of Genesis through Deuteronomy — covenant, law, tabernacle, and the formation of Israel — as foundational for the whole biblical narrative."),
    ("Historical Books of the Old Testament",
     "Joshua through Esther: the conquest, monarchy, exile, and return, with attention to prophetic critique of leadership and God's covenant faithfulness."),
    ("Wisdom and Poetic Literature",
     "Job, Psalms, Proverbs, Ecclesiastes, and Song of Songs — the fear of the Lord, biblical wisdom, worship, and the human condition."),
    ("Major and Minor Prophets",
     "The prophetic corpus: covenant lawsuit, messianic expectation, social justice, and the day of the Lord."),
    ("The Gospels and Life of Christ",
     "A harmonized study of Matthew, Mark, Luke, and John examining the person, teaching, miracles, death, and resurrection of Jesus."),
    ("Acts and Pauline Epistles",
     "The Spirit-empowered expansion of the Church and Paul's letters to congregations, with themes of grace, mission, and community formation."),
    ("General Epistles and Revelation",
     "Hebrews through Jude and the Apocalypse: perseverance, apostolic witness, and biblical eschatology."),
    ("Biblical Hebrew Fundamentals",
     "Introduction to the Hebrew alphabet, vocabulary, and basic grammar to enable elementary reading of the Old Testament."),
    ("Biblical Greek Fundamentals",
     "Introduction to Koine Greek — alphabet, nouns, verbs, and syntax — for reading the New Testament in its original language."),
    ("Biblical Theology",
     "Tracing major biblical themes — kingdom, covenant, temple, exile — across the whole canon toward their fulfillment in Christ."),
]

THEOLOGY_ADVANCED = [
    ("Systematic Theology I",
     "Advanced treatment of prolegomena, theology proper, and the doctrine of Scripture, engaging historic creeds and contemporary theologians."),
    ("Systematic Theology II",
     "Advanced anthropology, hamartiology, Christology, and soteriology with confessional engagement across traditions."),
    ("Systematic Theology III",
     "Advanced pneumatology, ecclesiology, and eschatology with attention to the charismatic and Pentecostal traditions."),
    ("Historical Theology",
     "The development of Christian doctrine through the Councils, Reformation, and modern debates, and their impact on contemporary ministry."),
    ("Apologetics: Defending the Faith",
     "Classical, evidential, and presuppositional apologetics for engaging skepticism, other religions, and secular worldviews."),
    ("African American Church History and Theology",
     "The Black Church tradition — from slave religion through the civil rights movement to contemporary Black theology — and its gifts to global Christianity."),
    ("Pentecostal and Charismatic Theology",
     "The theology and history of Spirit-empowered movements, including baptism in the Holy Spirit, spiritual gifts, and healing."),
    ("Contemporary Theological Issues",
     "Engagement with current debates — gender, race, justice, sexuality, technology — from a biblically faithful perspective."),
]

COUNSELING = [
    ("Introduction to Christian Counseling",
     "Foundations of Christian counseling — theological anthropology, the counselor's calling, integration of faith and psychology, and ethical practice."),
    ("Theories of Personality and Counseling",
     "Major counseling theories — psychodynamic, cognitive-behavioral, humanistic, systemic — evaluated through a Christian worldview."),
    ("Counseling Techniques and Skills",
     "Foundational skills: active listening, empathic reflection, questioning, goal setting, and structuring sessions."),
    ("Marriage and Family Counseling",
     "Biblical foundations of marriage, family systems theory, premarital counseling, marital conflict, parenting, and divorce recovery."),
    ("Grief, Trauma, and Crisis Counseling",
     "Assessment and intervention for acute crisis, grief and loss, and trauma, including a trauma-informed approach to ministry."),
    ("Addictions and Recovery",
     "The nature of addiction, biblical frameworks for freedom, recovery models, and the counselor's role alongside medical and support-group care."),
    ("Child and Adolescent Counseling",
     "Developmental theory, common presenting issues in youth, play and expressive techniques, and family-of-origin considerations."),
    ("Group Counseling",
     "The theory and practice of therapeutic groups — formation, stages, leadership, and boundary management."),
    ("Ethics and Professional Practice in Counseling",
     "Confidentiality, mandated reporting, dual relationships, scope of practice, and the intersection of counseling with pastoral authority."),
    ("Sexuality, Identity, and Christian Counseling",
     "A pastoral, biblically anchored, compassionate framework for counseling on sexuality, gender, and identity questions."),
]

PSYCHOLOGY = [
    ("General Psychology",
     "A survey of scientific psychology — biological, cognitive, developmental, social, and abnormal — evaluated from a Christian worldview."),
    ("Developmental Psychology",
     "Human development from prenatal life through late adulthood, with attention to spiritual formation across the lifespan."),
    ("Abnormal Psychology",
     "Classification and understanding of psychological disorders using DSM categories, integrated with biblical anthropology."),
    ("Cognitive Psychology and the Christian Mind",
     "Perception, attention, memory, and reasoning, with theological reflection on the renewing of the mind (Romans 12:2)."),
    ("Social Psychology and the Church",
     "Group dynamics, conformity, persuasion, and prejudice, applied to the life and health of congregations."),
    ("Research Methods in Psychology",
     "Experimental design, statistical reasoning, and evaluation of published research in psychology and counseling."),
]

LEADERSHIP = [
    ("Foundations of Christian Leadership",
     "Biblical models of leadership — Moses, Nehemiah, Jesus, Paul — and contemporary theories of servant, transformational, and adaptive leadership."),
    ("Vision, Strategy, and Execution",
     "How Christian leaders discern vision, translate it into strategy, and execute through healthy teams and disciplined systems."),
    ("Team Building and Conflict Resolution",
     "Building high-trust teams, managing conflict biblically, and cultivating a culture of grace and accountability."),
    ("Coaching and Developing Leaders",
     "Multiplying leaders through mentoring, coaching, delegation, and succession planning."),
    ("Leading Organizational Change",
     "Change theory, congregational systems, resistance patterns, and shepherding people through transition."),
    ("Communication and Public Speaking",
     "Persuasive communication, storytelling, media presence, and the ethics of Christian influence."),
    ("Emotional Intelligence for Leaders",
     "Self-awareness, self-regulation, empathy, and social skill for leaders under pressure."),
    ("Cross-Cultural and Urban Leadership",
     "Leading in multicultural, multi-generational, and urban contexts with cultural humility and gospel-centered vision."),
]

BUSINESS = [
    ("Foundations of Christian Business",
     "A biblical theology of work, wealth, and vocation as the platform for entrepreneurship and enterprise for the glory of God."),
    ("Marketing and Brand Strategy",
     "Principles of marketing — segmentation, positioning, digital channels, and brand storytelling — applied to ministries and Christian businesses."),
    ("Financial Stewardship and Accounting",
     "Personal and organizational finance, basic accounting, budgeting, and stewardship principles from Scripture."),
    ("Entrepreneurship: From Idea to Launch",
     "Opportunity recognition, business model design, market validation, and the launch of a new venture."),
    ("Nonprofit Management and Fundraising",
     "501(c)(3) fundamentals, board development, donor relations, grant writing, and sustainable fundraising."),
    ("Digital Marketing and Social Media",
     "Content strategy, SEO, paid social, email marketing, and analytics for growing Christian brands and ministries."),
    ("Business Law and Ethics",
     "Contracts, intellectual property, employment law, and biblical ethics in commercial practice."),
    ("Operations and Systems Design",
     "Process design, quality, technology stacks, and building organizations that scale without losing mission."),
]

ETHICS = [
    ("Christian Ethics",
     "A biblical, virtue-informed framework for moral reasoning applied to personal, ministry, and public life."),
    ("Bioethics and Life Issues",
     "Beginning-of-life, end-of-life, and biotechnology issues examined through Scripture and the historic Christian tradition."),
    ("Social Justice and the Church",
     "Biblical justice, race, poverty, and the Church's public witness in contemporary society."),
    ("Ethical Leadership in Organizations",
     "Case-based study of integrity, whistleblowing, governance failures, and the cultivation of ethical cultures."),
]

CHAPLAINCY = [
    ("Foundations of Chaplaincy Ministry",
     "The history, theology, and diverse settings of chaplaincy — hospital, hospice, military, corporate, prison, and first-responder."),
    ("Clinical Pastoral Care",
     "The theory and practice of pastoral care in clinical settings, including visitation, presence, prayer, and interdisciplinary teamwork."),
    ("Trauma and Critical Incident Response",
     "Providing spiritual care during trauma, mass casualty, and critical incidents, including care of first responders and their families."),
    ("Interfaith and Pluralistic Ministry",
     "Ministering with integrity in religiously pluralistic settings, honoring conviction and hospitality simultaneously."),
    ("Chaplain Ethics and Professional Boundaries",
     "Confidentiality, scope of practice, documentation, and dual accountability to institution and calling."),
    ("End-of-Life and Bereavement Ministry",
     "Companioning the dying, funeral ministry, and long-term grief care for families and communities."),
    ("Military and First-Responder Chaplaincy",
     "The unique demands of chaplaincy to those in uniform — culture, deployment, moral injury, and PTSD."),
    ("Hospital and Hospice Chaplaincy",
     "Rounds, palliative care, ethics consults, and partnership with medical teams in Christ-honoring care."),
]

FINE_ARTS = [
    ("Theology of the Arts",
     "A biblical framework for beauty, creativity, and the arts as vehicles of worship, witness, and cultural formation."),
    ("Sacred Music and Worship Arts",
     "The history and craft of Christian music — from the Psalter through gospel and contemporary worship — with attention to congregational song."),
    ("Visual Arts in the Christian Tradition",
     "Painting, sculpture, iconography, and architecture across Christian history and their contemporary application."),
    ("Drama, Film, and Storytelling for Ministry",
     "Narrative craft in performance, screen, and pulpit as gospel witness in a media-saturated culture."),
    ("Digital Media and Content Creation",
     "Video production, podcasting, and design fundamentals for the church communicator and Christian artist."),
    ("Creative Writing and Christian Publishing",
     "Craft of prose and poetry, and the landscape of Christian publishing from proposal to platform."),
]

PROPHETIC = [
    ("Introduction to Prophetic Ministry",
     "A biblical theology of prophecy from the Old Testament prophets to the New Testament gift, and its function in the contemporary Church."),
    ("Hearing the Voice of God",
     "Discerning God's voice through Scripture, the Spirit, community, and circumstances, with practical exercises in listening prayer."),
    ("Prophetic Gifts and Spiritual Discernment",
     "The gifts of the Spirit (1 Corinthians 12), testing prophecy (1 Thessalonians 5:19-21), and the fruit of a mature prophetic voice."),
    ("Prophetic Ministry in the Local Church",
     "How the prophetic gift builds up the body — through preaching, personal ministry, and corporate worship — under pastoral covering."),
    ("Intercession and Spiritual Warfare",
     "The theology and practice of intercessory prayer, deliverance, and spiritual warfare in Scripture and Church history."),
    ("The Prophetic and Justice",
     "The prophetic tradition's call for justice, mercy, and humility, and its implications for the Church's public witness."),
]

COACHING = [
    ("Foundations of Christian Coaching",
     "The philosophy and ethics of Christian coaching — its similarities to and distinctions from counseling, mentoring, and pastoral care."),
    ("Coaching Skills and Powerful Questions",
     "Core coaching competencies — presence, active listening, powerful questioning, and forwarding action — grounded in ICF standards."),
    ("Life and Executive Coaching",
     "Adapting coaching for personal life, career, and executive leadership contexts with case-based practice."),
    ("Building a Coaching Practice",
     "Niching, marketing, contracts, and business systems for launching and sustaining a Christian coaching practice."),
    ("Coaching Ethics and Confidentiality",
     "Boundaries, dual relationships, mandated reporting, and best practices for ethical Christian coaches."),
]

EDUCATION = [
    ("Foundations of Christian Education",
     "The biblical and philosophical foundations of Christian teaching, from Deuteronomy 6 to the Great Commission's teaching mandate."),
    ("Curriculum Design and Assessment",
     "Backward design of learning experiences, scope and sequence, and formative and summative assessment."),
    ("Teaching Methods for Every Age",
     "Developmentally appropriate methods for teaching children, youth, adults, and multi-generational settings."),
    ("Discipleship and Small Group Ministry",
     "The theology and practice of small groups, life-on-life discipleship, and reproducing disciples."),
    ("Educational Technology and Online Learning",
     "LMS platforms, video instruction, and the design of self-paced and hybrid Christian learning experiences."),
]

PASTORAL = [
    ("Pastoral Theology",
     "The theology of the pastorate — call, ordination, character, and the shape of pastoral ministry across seasons of life."),
    ("Pastoral Counseling",
     "Short-term counseling in the pastoral setting, referral practices, and integrating counsel with preaching and prayer."),
    ("Weddings, Funerals, and Life Events",
     "The theology and craft of officiating at the pivotal moments of a congregation's life."),
    ("Evangelism and Church Planting",
     "Personal evangelism, congregational witness, and models of church planting in urban and multicultural contexts."),
    ("Missions and the Global Church",
     "The biblical foundation of mission, the history of missions, and contemporary practice in a globalized world."),
]

RESEARCH = [
    ("Research Methods and Academic Writing",
     "Formulating research questions, literature review, qualitative and quantitative methods, and academic writing at the graduate level."),
    ("Dissertation Proposal Development",
     "Refining a dissertation topic, writing a robust proposal, and constructing the theoretical framework."),
    ("Dissertation Research and Writing I",
     "Independent research under faculty supervision — data collection, analysis, and chapter drafting."),
    ("Dissertation Research and Writing II",
     "Continued dissertation work culminating in a completed manuscript ready for defense."),
    ("Doctoral Seminar in Christian Scholarship",
     "Advanced reading and discussion of primary sources in the student's field of specialization."),
]

# ---------------------------------------------------------------------------
# PROGRAM COMPOSITIONS — maps program title to a list of course pool selections.
# Each entry is (pool_name, index_in_pool). The generator resolves it to the
# actual course tuple, then generates lessons and an exam bank for it.
# ---------------------------------------------------------------------------

POOLS = {
    "core_foundation": CORE_FOUNDATION,
    "core_ministry": CORE_MINISTRY,
    "biblical_studies": BIBLICAL_STUDIES,
    "theology_advanced": THEOLOGY_ADVANCED,
    "counseling": COUNSELING,
    "psychology": PSYCHOLOGY,
    "leadership": LEADERSHIP,
    "business": BUSINESS,
    "ethics": ETHICS,
    "chaplaincy": CHAPLAINCY,
    "fine_arts": FINE_ARTS,
    "prophetic": PROPHETIC,
    "coaching": COACHING,
    "education": EDUCATION,
    "pastoral": PASTORAL,
    "research": RESEARCH,
}

def core8():
    """Reusable 8-course foundational Christian core."""
    return [("core_foundation", i) for i in range(8)]

def core4_ministry():
    return [("core_ministry", i) for i in range(4)]

# Bachelor's (14 courses): 8 foundation + 6 discipline
# Master's (12 courses): 4 foundation + 8 discipline (advanced)
# Doctoral (8 courses): 3 advanced discipline + 5 research/seminar mix
# Dual (12 courses): 4 foundation + 4 discipline A + 4 discipline B

PROGRAMS = {
    # ------------------ BACHELOR'S ------------------
    "Bachelor of Arts in Ministry Chaplaincy": core8() + [("chaplaincy", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Religious Fine Arts": core8() + [("fine_arts", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Christian Coaching": core8() + [("coaching", 0), ("coaching", 1), ("coaching", 2), ("coaching", 3), ("coaching", 4), ("leadership", 0)],
    "Bachelor of Science in Christian Psychology": core8() + [("psychology", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Christian Counseling": core8() + [("counseling", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Prophetic Ministry": core8() + [("prophetic", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Theology (Biblical Studies)": core8() + [("biblical_studies", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Christian Ethics & Management": core8() + [("ethics", 0), ("ethics", 1), ("ethics", 3), ("business", 0), ("business", 2), ("leadership", 0)],
    "Bachelor of Arts in Christian Leadership and Business": core8() + [("leadership", 0), ("leadership", 1), ("leadership", 2), ("business", 0), ("business", 2), ("business", 3)],
    "Bachelor of Arts in Christian Leadership": core8() + [("leadership", i) for i in [0, 1, 2, 3, 4, 5]],
    "Bachelor of Arts in Christian Ethics and Marketing": core8() + [("ethics", 0), ("ethics", 3), ("business", 1), ("business", 5), ("business", 0), ("leadership", 5)],
    "Bachelor of Arts in Christian Entrepreneurship": core8() + [("business", 0), ("business", 3), ("business", 1), ("business", 2), ("business", 6), ("business", 7)],

    # ------------------ MASTER'S (12 courses = 4 foundation + 8 discipline) ------------------
    "Master of Divinity (M.Div.) in Chaplaincy": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("chaplaincy", i) for i in range(8)],
    "Master of Arts in Christian Education": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("education", i) for i in range(5)] + [("pastoral", 1), ("leadership", 3), ("leadership", 7)],
    "Master of Arts in Christian Counseling": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("counseling", i) for i in [0, 1, 2, 3, 4, 5, 8, 9]],
    "Master of Science in Christian Psychology": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("psychology", i) for i in range(6)] + [("counseling", 0), ("counseling", 8)],
    "Master of Science in Practical Ministry": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("core_ministry", i) for i in range(4)] + [("pastoral", i) for i in range(4)],
    "Master of Arts in Theology (Divinity)": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("theology_advanced", i) for i in range(8)],
    "Master of Arts in Pastoral Ministry": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("pastoral", i) for i in range(5)] + [("core_ministry", 1), ("core_ministry", 2), ("counseling", 0)],
    "Master of Arts in Prophetic Ministry": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("prophetic", i) for i in range(6)] + [("pastoral", 0), ("core_ministry", 1)],
    "Master of Arts in Christian Ethics & Management": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("ethics", i) for i in range(4)] + [("leadership", 0), ("leadership", 3), ("business", 0), ("business", 6)],
    "Master of Arts in Christian Entrepreneurship": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("business", i) for i in range(8)],
    "Master of Arts in Christian Ethics and Marketing": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("ethics", 0), ("ethics", 3), ("business", 1), ("business", 5), ("business", 0), ("leadership", 5), ("business", 6), ("leadership", 0)],
    "Master of Arts in Christian Leadership": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("leadership", i) for i in range(8)],

    # ------------------ DOCTORAL (8 courses = 3 advanced + 5 research/seminar) ------------------
    "Doctor of Divinity (D.Div.) in Chaplaincy and Pastoral Care": [("chaplaincy", 2), ("chaplaincy", 5), ("chaplaincy", 7)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Counseling": [("counseling", 4), ("counseling", 5), ("counseling", 8)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Counseling – MFC (Marriage, Family & Child Therapy)": [("counseling", 3), ("counseling", 6), ("counseling", 4)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Theology (Divinity)": [("theology_advanced", 0), ("theology_advanced", 3), ("theology_advanced", 7)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Religious Fine Arts": [("fine_arts", 0), ("fine_arts", 3), ("fine_arts", 5)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Practical Ministry": [("core_ministry", 0), ("pastoral", 3), ("pastoral", 4)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Ethics & Management": [("ethics", 0), ("ethics", 3), ("leadership", 4)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Leadership and Business": [("leadership", 0), ("leadership", 4), ("business", 3)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Entrepreneurship": [("business", 3), ("business", 6), ("business", 7)] + [("research", i) for i in range(5)],
    "Doctor of Philosophy in Christian Entrepreneurship – Executive Leadership": [("business", 3), ("leadership", 0), ("leadership", 4)] + [("research", i) for i in range(5)],

    # ------------------ DUAL (12 courses = 4 foundation + 4 discipline A + 4 discipline B) ------------------
    "MA in Christian Counseling + PhD in Christian Leadership & Business": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("counseling", i) for i in [0, 1, 2, 4]] + [("leadership", 0), ("leadership", 4), ("business", 3), ("research", 0)],
    "MA in Theology (Divinity) + PhD in Christian Leadership & Business": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("theology_advanced", i) for i in [0, 1, 2, 3]] + [("leadership", 0), ("leadership", 4), ("business", 3), ("research", 0)],
    "MA in Theology (Divinity) + PhD in Practical Ministry": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("theology_advanced", i) for i in [0, 1, 2, 3]] + [("core_ministry", 0), ("pastoral", 3), ("pastoral", 4), ("research", 0)],
    "M.Sc. in Practical Ministry + PhD in Christian Counseling": [("core_foundation", i) for i in [3, 4, 5, 7]] + [("core_ministry", i) for i in range(4)] + [("counseling", 4), ("counseling", 5), ("counseling", 8), ("research", 0)],
}


# ---------------------------------------------------------------------------
# LESSON GENERATION
# Each course gets 5 lessons: Introduction, two content lessons, Application,
# and Integration & Review. Lessons are generated from the course title and
# description so each program's lesson set feels tailored, not templated.
# ---------------------------------------------------------------------------

def make_lessons(course_title: str, course_description: str) -> list[dict]:
    """Return a list of 5 lesson dicts: {title, contentText}."""
    core_topic = course_title
    # Derive a short subject noun for the lesson prose
    subject = core_topic.split(":")[0].strip()
    # Avoid awkward duplicated prefixes like 'Introduction to Introduction to ...'
    lesson1_prefix = "Overview of" if subject.lower().startswith(("introduction ", "foundations ", "introduction to", "foundations of")) else "Introduction to"
    lesson2_prefix = "Biblical Foundations for" if subject.lower().startswith(("biblical", "foundations", "introduction")) else "Biblical and Theological Foundations of"

    lessons = [
        {
            "title": f"Lesson 1: {lesson1_prefix} {subject}",
            "contentText": (
                f"## Welcome\n\n"
                f"This opening lesson introduces the scope, purpose, and importance of **{subject}** "
                f"for Christian ministry and life. {course_description}\n\n"
                f"### Learning Objectives\n"
                f"By the end of this lesson you will be able to:\n"
                f"- State the biblical and historical foundation of {subject}.\n"
                f"- Explain why this course is essential for the calling you are pursuing at ACU.\n"
                f"- Outline the structure of the remaining lessons and the final exam.\n\n"
                f"### Key Reading\n"
                f"- Assigned Scripture passages (see course reading list).\n"
                f"- Recommended chapters from the course textbook.\n\n"
                f"### Reflection\n"
                f"Take fifteen minutes in prayer and journal how the Lord may be preparing you "
                f"through this course. Bring one question you hope to have answered by the end.\n\n"
                f"*Instructor content, video lecture, or PDF handouts may be uploaded here by the administrator.*"
            ),
        },
        {
            "title": f"Lesson 2: {lesson2_prefix} {subject}",
            "contentText": (
                f"## Scripture as Our Foundation\n\n"
                f"Before we build practice we build conviction. This lesson traces the biblical "
                f"and theological roots of {subject} across the canon of Scripture — showing how "
                f"the whole story of redemption informs this discipline.\n\n"
                f"### What You Will Study\n"
                f"1. Old Testament foundations relevant to {subject}.\n"
                f"2. The teaching of Christ and the apostles on this theme.\n"
                f"3. How the historic Church has understood and practiced it.\n"
                f"4. Contemporary theological voices — including Pentecostal and African American traditions.\n\n"
                f"### Application\n"
                f"Write a one-page reflection identifying the passage that has most shaped your "
                f"understanding of {subject} and why.\n\n"
                f"*Instructor content, video lecture, or PDF handouts may be uploaded here by the administrator.*"
            ),
        },
        {
            "title": f"Lesson 3: Core Concepts and Frameworks in {subject}",
            "contentText": (
                f"## Building the Toolkit\n\n"
                f"This lesson walks through the essential concepts, definitions, and frameworks "
                f"you must master to work confidently in {subject}. Expect to encounter both "
                f"classical and contemporary treatments.\n\n"
                f"### Topics Covered\n"
                f"- Foundational vocabulary and definitions.\n"
                f"- Primary frameworks and models used by practitioners.\n"
                f"- Common misconceptions and how to correct them.\n"
                f"- Case studies drawn from real ministry and marketplace settings.\n\n"
                f"### Practice\n"
                f"Complete the concept-mapping exercise in the course workbook. Bring your map "
                f"to the next lesson.\n\n"
                f"*Instructor content, video lecture, or PDF handouts may be uploaded here by the administrator.*"
            ),
        },
        {
            "title": f"Lesson 4: Applied Practice in {subject}",
            "contentText": (
                f"## From Theory to Practice\n\n"
                f"Now we move from concept to competency. This lesson equips you to apply "
                f"{subject} in real ministry, business, and pastoral contexts — with special "
                f"attention to urban, multicultural, and Spirit-empowered settings.\n\n"
                f"### Practical Focus\n"
                f"- Skill-building exercises with peer feedback.\n"
                f"- Case-based analysis of contemporary situations.\n"
                f"- Ethical and pastoral considerations at every step.\n"
                f"- Cultural competence and humility.\n\n"
                f"### Assignment\n"
                f"Prepare a written case study (500-750 words) applying {subject} to a situation "
                f"you have encountered or expect to encounter in your calling.\n\n"
                f"*Instructor content, video lecture, or PDF handouts may be uploaded here by the administrator.*"
            ),
        },
        {
            "title": f"Lesson 5: Integration, Review, and the Final Exam",
            "contentText": (
                f"## Bringing It Together\n\n"
                f"In this final lesson we integrate what you have learned, review the whole course, "
                f"and prepare for the final exam.\n\n"
                f"### Integration\n"
                f"- Connect {subject} to the other courses in your degree program.\n"
                f"- Reflect on how this course has shaped your understanding of your calling.\n"
                f"- Identify three concrete practices you will carry into ministry or the marketplace.\n\n"
                f"### Exam Preparation\n"
                f"Review the study guide provided in the course workbook. The final exam is 15 "
                f"multiple-choice questions covering the full course. A passing score is 70 percent.\n\n"
                f"When you are ready, take the final exam from the course page.\n\n"
                f"*Instructor content, video lecture, or PDF handouts may be uploaded here by the administrator.*"
            ),
        },
    ]
    return lessons


# ---------------------------------------------------------------------------
# EXAM GENERATION — 15 questions per course. We build a bank of question
# templates that reference the course title/subject so every exam is unique
# to its course while still varied across the whole catalog.
# ---------------------------------------------------------------------------

def make_exam(course_title: str, course_description: str) -> list[dict]:
    """Return 15 multiple-choice question dicts."""
    subject = course_title.split(":")[0].strip()

    # Template bank — each template yields (question, options, correct_index).
    # We compose them so the correct answer is theologically and academically sound.
    q = []

    q.append({
        "question": f"What is the primary aim of the course '{course_title}'?",
        "options": [
            f"To equip students with a biblical, historical, and practical foundation in {subject}",
            "To provide entertainment for casual learners",
            "To replace the local church's teaching ministry",
            "To promote a single denominational viewpoint",
        ],
        "correctAnswer": 0,
    })

    q.append({
        "question": "Which of the following best describes the authority of Scripture in ACU coursework?",
        "options": [
            "Scripture is one useful voice among many",
            "The Bible is the inspired, authoritative Word of God and the foundation for study",
            "Scripture is optional in advanced coursework",
            "Only the New Testament carries authority for today",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": f"According to this course, why does {subject} matter for Christian ministry?",
        "options": [
            "It has no direct bearing on ministry",
            "It is only relevant to academic scholars",
            "It shapes competence, character, and calling for effective service",
            "It is mainly a credentialing requirement",
        ],
        "correctAnswer": 2,
    })

    q.append({
        "question": "Which principle should guide the Christian student when studying any discipline?",
        "options": [
            "Faith and study belong to separate compartments",
            "All truth is God's truth; study is an act of worship",
            "Only theology is properly Christian study",
            "Christian study rejects engagement with other disciplines",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": "What role does prayer play in the study process at ACU?",
        "options": [
            "Prayer is unrelated to academic work",
            "Prayer replaces the need for careful study",
            "Prayer accompanies study, asking the Spirit for wisdom and understanding",
            "Prayer is reserved for pastoral courses only",
        ],
        "correctAnswer": 2,
    })

    q.append({
        "question": f"The historical-grammatical method interprets Scripture by attending primarily to:",
        "options": [
            "The reader's private impressions alone",
            "The author's intent in the original historical and grammatical context",
            "Whatever meaning best suits contemporary politics",
            "Only allegorical readings",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": "Which of the following is a hallmark of mature Christian character?",
        "options": [
            "Impatience with others",
            "The fruit of the Spirit — love, joy, peace, and self-control",
            "A polished public image regardless of private conduct",
            "Fear of failure",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": f"In applying {subject}, cultural humility means:",
        "options": [
            "Rejecting one's own cultural identity",
            "Assuming all cultures are theologically equivalent",
            "Approaching others with respect, teachability, and self-awareness",
            "Ignoring cultural difference entirely",
        ],
        "correctAnswer": 2,
    })

    q.append({
        "question": "Which is the best summary of a Christian view of vocation?",
        "options": [
            "Only pastoral ministry counts as calling",
            "Every believer has a calling to glorify God in their sphere of work",
            "Vocation is a purely secular concept",
            "Vocation applies only to full-time missionaries",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": "The Great Commission (Matthew 28:18-20) commands the Church to:",
        "options": [
            "Build large buildings",
            "Make disciples of all nations, baptizing and teaching them",
            "Focus exclusively on personal salvation",
            "Wait passively for people to come to church",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": f"Ethical practice in {subject} requires, first and foremost:",
        "options": [
            "Compliance with the minimum legal requirement",
            "Personal loyalty to a specific leader",
            "Integrity before God, honoring both Scripture and neighbor",
            "Following whatever the majority approves",
        ],
        "correctAnswer": 2,
    })

    q.append({
        "question": "A trauma-informed approach to ministry recognizes that:",
        "options": [
            "All spiritual struggles are simply psychological problems",
            "People carrying trauma need safety, choice, and compassion in ministry contexts",
            "Trauma is irrelevant to spiritual formation",
            "Only professional therapists can address trauma in any way",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": "Which is a biblical model of servant leadership?",
        "options": [
            "Jesus washing His disciples' feet in John 13",
            "Pharaoh oppressing Israel in Exodus 1",
            "The rich fool building bigger barns in Luke 12",
            "Diotrephes seeking preeminence in 3 John",
        ],
        "correctAnswer": 0,
    })

    q.append({
        "question": f"The final integration of {subject} should lead the student toward:",
        "options": [
            "Personal pride in academic achievement",
            "Christlike service, humble practice, and continued growth",
            "Detachment from the local church",
            "Certainty on every disputed question",
        ],
        "correctAnswer": 1,
    })

    q.append({
        "question": "The passing score for the ACU final course exam is:",
        "options": [
            "50 percent",
            "60 percent",
            "70 percent",
            "90 percent",
        ],
        "correctAnswer": 2,
    })

    return q


# ---------------------------------------------------------------------------
# DATABASE OPERATIONS
# ---------------------------------------------------------------------------

def connect():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def clear_existing_curriculum(conn):
    """Wipe placeholder courses/lessons/quizzes so we can regenerate cleanly.
    Preserves users, enrollments, progress, certificates, and programs."""
    cur = conn.cursor()
    cur.execute("DELETE FROM quiz_questions")
    cur.execute("DELETE FROM quiz_attempts")
    cur.execute("DELETE FROM quizzes")
    cur.execute("DELETE FROM lesson_progress")
    cur.execute("DELETE FROM lessons")
    cur.execute("DELETE FROM courses")
    conn.commit()
    print("Cleared existing courses/lessons/quizzes.")


def generate_all(conn):
    now = int(time.time())
    cur = conn.cursor()
    programs = {row[1]: row[0] for row in cur.execute("SELECT id, title FROM programs").fetchall()}
    total_courses = 0
    total_lessons = 0
    total_questions = 0

    for program_title, composition in PROGRAMS.items():
        program_id = programs.get(program_title)
        if not program_id:
            print(f"WARN: program not found in db: {program_title}")
            continue

        for position, (pool_name, idx) in enumerate(composition):
            pool = POOLS[pool_name]
            course_title, course_description = pool[idx]

            cur.execute(
                "INSERT INTO courses (program_id, title, description, position) VALUES (?, ?, ?, ?)",
                (program_id, course_title, course_description, position),
            )
            course_id = cur.lastrowid
            total_courses += 1

            # Lessons
            lessons = make_lessons(course_title, course_description)
            for lp, lesson in enumerate(lessons):
                cur.execute(
                    "INSERT INTO lessons (course_id, title, type, content_url, content_text, position, duration_minutes) "
                    "VALUES (?, ?, 'text', '', ?, ?, ?)",
                    (course_id, lesson["title"], lesson["contentText"], lp, 30),
                )
                total_lessons += 1

            # Quiz + questions
            cur.execute(
                "INSERT INTO quizzes (course_id, title, passing_score) VALUES (?, ?, 70)",
                (course_id, f"Final Exam — {course_title}"),
            )
            quiz_id = cur.lastrowid
            questions = make_exam(course_title, course_description)
            for qp, question in enumerate(questions):
                cur.execute(
                    "INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, position) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (
                        quiz_id,
                        question["question"],
                        json.dumps(question["options"]),
                        question["correctAnswer"],
                        qp,
                    ),
                )
                total_questions += 1

        print(f"OK  {program_title}: {len(composition)} courses inserted.")

    conn.commit()
    print(f"\nDone. {total_courses} courses, {total_lessons} lessons, {total_questions} exam questions.")


if __name__ == "__main__":
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found at {DB_PATH}")
    conn = connect()
    try:
        clear_existing_curriculum(conn)
        generate_all(conn)
    finally:
        conn.close()
