"use client";

import "./courses.css";
import { useState } from "react";
import { ArrowRight, BookOpen, Check, Clock3, GraduationCap, Play } from "lucide-react";

type Course = {
  id: string;
  title: string;
  topic: string;
  description: string;
  duration: string;
  lessons: number;
  skills: string[];
};

// Display-only examples. A course provider and enrollment service can replace these later.
const sampleCourses: Course[] = [
  { id: "sample-data-storytelling", title: "Data storytelling essentials", topic: "Data skills", description: "Turn a simple set of numbers into a clear, useful story for a team or client.", duration: "4 hours", lessons: 5, skills: ["Data literacy", "Presentation"] },
  { id: "sample-spreadsheets", title: "Spreadsheets for everyday work", topic: "Data skills", description: "Practice formulas, tables, and small dashboards for common workplace tasks.", duration: "6 hours", lessons: 8, skills: ["Spreadsheets", "Reporting"] },
  { id: "sample-ai-workflows", title: "Working confidently with AI tools", topic: "Digital tools", description: "Learn to write useful prompts, check results, and keep a human review in the loop.", duration: "3 hours", lessons: 4, skills: ["AI literacy", "Critical thinking"] },
  { id: "sample-project-planning", title: "A practical introduction to project planning", topic: "Workplace skills", description: "Break a goal into milestones, manage priorities, and communicate progress.", duration: "5 hours", lessons: 6, skills: ["Planning", "Collaboration"] },
  { id: "sample-service-design", title: "Designing better customer experiences", topic: "Workplace skills", description: "Map a customer journey and find small improvements that make a difference.", duration: "4 hours", lessons: 5, skills: ["Service design", "Problem solving"] },
];

const startingProgress: Record<string, number> = {
  "sample-data-storytelling": 40,
  "sample-ai-workflows": 25,
};

export default function CoursesPage() {
  const [progress, setProgress] = useState<Record<string, number>>(startingProgress);
  const [status, setStatus] = useState<"available" | "progress">("available");
  const [topic, setTopic] = useState("All topics");
  const topics = ["All topics", ...new Set(sampleCourses.map((course) => course.topic))];
  const visible = sampleCourses.filter((course) => (status === "progress" ? course.id in progress : !(course.id in progress)) && (topic === "All topics" || course.topic === topic));
  const inProgressCount = Object.keys(progress).length;

  const addCourse = (id: string) => {
    setProgress((current) => ({ ...current, [id]: 0 }));
    setTopic("All topics");
    setStatus("progress");
  };
  const recordLesson = (id: string) => {
    const lessons = sampleCourses.find((course) => course.id === id)?.lessons ?? 5;
    setProgress((current) => ({ ...current, [id]: Math.min(100, Math.round(current[id] + 100 / lessons)) }));
  };

  return (
    <div className="courses-page">
      <section className="courses-hero" aria-labelledby="courses-title">
        <div className="courses-hero-copy"><span className="courses-kicker">LEARN FOR WHAT COMES NEXT</span><h1 id="courses-title">Courses for your <em>next step.</em></h1><p>Browse learning ideas, choose where to begin, and keep an eye on your progress.</p><span className="courses-preview-note">Design preview · sample courses and progress only. No enrollment or learning data is saved yet.</span></div>
        <div className="courses-hero-art" aria-hidden="true"><div className="courses-hero-icon"><GraduationCap size={46} strokeWidth={1.4} /></div><div className="courses-hero-line" /><span>Learn a little. Move forward.</span></div>
      </section>

      <section className="courses-catalog" aria-labelledby="courses-catalog-title">
        <div className="courses-section-head"><div><span className="courses-kicker">YOUR LEARNING SPACE</span><h2 id="courses-catalog-title">Explore courses</h2><p>Pick a course to see how an in progress learning path could look.</p></div><div className="courses-count"><BookOpen size={18} aria-hidden /><span>{inProgressCount} in progress</span></div></div>
        <div className="courses-controls"><div className="courses-field"><label htmlFor="course-status">Show courses</label><select id="course-status" value={status} onChange={(event) => setStatus(event.target.value as "available" | "progress")}><option value="available">Available</option><option value="progress">In progress</option></select></div><div className="courses-field"><label htmlFor="course-topic">Topic</label><select id="course-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>{topics.map((option) => <option key={option}>{option}</option>)}</select></div><span className="courses-results" aria-live="polite">{visible.length} {visible.length === 1 ? "course" : "courses"} shown</span></div>
        {visible.length ? <div className="courses-grid">{visible.map((course) => {
          const courseProgress = progress[course.id];
          const enrolled = course.id in progress;
          return <article className="courses-card" key={course.id}><div className="courses-card-top"><span className="courses-topic">{course.topic}</span><span className="courses-sample">SAMPLE COURSE</span></div><div className="courses-card-icon"><BookOpen size={24} strokeWidth={1.5} aria-hidden /></div><h3>{course.title}</h3><p>{course.description}</p><div className="courses-skills" aria-label="Skills covered">{course.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="courses-card-bottom"><span className="courses-duration"><Clock3 size={15} aria-hidden />{course.duration} · {course.lessons} lessons</span>{enrolled ? <div className="courses-progress"><div className="courses-progress-label"><span>{courseProgress === 100 ? "Completed" : "Learning progress"}</span><strong>{courseProgress}%</strong></div><div className="courses-progress-track" role="progressbar" aria-label={`${course.title} learning progress`} aria-valuenow={courseProgress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${courseProgress}%` }} /></div><button className="courses-action" onClick={() => recordLesson(course.id)} disabled={courseProgress === 100}>{courseProgress === 100 ? <><Check size={16} aria-hidden /> Preview complete</> : <><Play size={15} aria-hidden /> Mark sample lesson complete</>}</button></div> : <button className="courses-action" onClick={() => addCourse(course.id)}>Add to my learning <ArrowRight size={16} aria-hidden /></button>}</div></article>;
        })}</div> : <div className="courses-empty"><BookOpen size={26} aria-hidden /><h3>No courses in this view</h3><p>Try another topic or switch the course status.</p><button onClick={() => setTopic("All topics")}>Show all topics</button></div>}
        <p className="courses-footnote">These entries and progress values demonstrate the interface. Course links, enrollment, and completion tracking will be connected later.</p>
      </section>
    </div>
  );
}
