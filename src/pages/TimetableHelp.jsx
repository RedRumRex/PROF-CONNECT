import { Link } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

const STEPS = [
  {
    title: 'Open your CSV file',
    body: 'Open the same CSV file you uploaded earlier — in Excel, Google Sheets, Numbers, or any plain text editor.',
  },
  {
    title: 'Make your changes',
    body: 'Edit the rows that need updating: day, start time, end time, subject, room, or instructor. You can also add, remove, or reorder rows.',
  },
  {
    title: 'Save it as .csv',
    body: 'Save the file, making sure it stays in .csv format (Excel and Google Sheets both let you pick "CSV" under File → Save As / Download).',
  },
  {
    title: 'Clear your current timetable',
    body: 'Come back to this Timetable page and click the "Clear" button to remove your existing schedule.',
  },
  {
    title: 'Upload the new CSV',
    body: 'Click "Upload Timetable" and select your updated file. Your new schedule will appear right away.',
  },
]

export default function TimetableHelp() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-28 lg:pb-8">

        {/* Header */}
        <div className="mb-6">
          <Link
            to="/timetable"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-4"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Timetable
          </Link>
          <h2 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">
            How to Change Your Timetable
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 opacity-70">
            There's no editing on the page itself — your timetable always comes from a CSV file, so updating it just means uploading a fresh one.
          </p>
        </div>

        {/* Steps */}
        <div className="glass-panel rounded-2xl p-6 md:p-8 space-y-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-container/20 border border-primary/20 flex items-center justify-center">
                <span className="font-headline font-extrabold text-primary text-sm">{i + 1}</span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-sm mb-1">{step.title}</p>
                <p className="text-on-surface-variant text-sm opacity-75 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Column reference */}
        <div className="glass-panel rounded-2xl p-6 md:p-8 mt-5">
          <p className="font-headline font-bold text-on-surface text-sm mb-3">CSV columns, for reference</p>
          <p className="text-on-surface-variant text-sm opacity-75 leading-relaxed mb-3">
            Each row needs: <code className="text-primary/90">day</code>, <code className="text-primary/90">start_time</code>,{' '}
            <code className="text-primary/90">end_time</code>, <code className="text-primary/90">subject</code>,{' '}
            <code className="text-primary/90">room</code>, and <code className="text-primary/90">instructor</code>.
          </p>
          <p className="text-on-surface-variant text-sm opacity-75 leading-relaxed">
            There's also an optional <code className="text-primary/90">type</code> column — set it to{' '}
            <code className="text-primary/90">lecture</code>, <code className="text-primary/90">tutorial</code>, or{' '}
            <code className="text-primary/90">lab</code> for each class. Leave it out, or leave a row blank, and it defaults to a lecture.
          </p>
        </div>

        <div className="mt-6">
          <Link
            to="/timetable"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Go upload your updated timetable
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
