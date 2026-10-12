import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Finished, Saved, Welcome } from './JoinScreens'
import StepScreen from './StepScreen'
import { doneCount, nextTask } from './logic'
import { joinerKey } from './queries'
import type { JoinerView } from './types'

type Saving = { title: string; view: JoinerView }

export default function JoinFlow({ token, view }: { token: string; view: JoinerView }) {
  const qc = useQueryClient()
  const [started, setStarted] = useState(false)
  const [saved, setSaved] = useState<Saving | null>(null)

  // Right after a step is saved the "Saved" screen shows, and the new data is only
  // taken in when the joiner taps the button. So the next step never flashes first.
  if (saved) {
    return (
      <Saved
        title={saved.title}
        last={nextTask(saved.view.tasks) === null}
        onNext={() => {
          qc.setQueryData(joinerKey(token), saved.view)
          setSaved(null)
        }}
      />
    )
  }

  const task = nextTask(view.tasks)
  if (task === null) return <Finished view={view} />
  if (!started) return <Welcome view={view} onStart={() => setStarted(true)} />

  return (
    <StepScreen
      key={task.id}
      token={token}
      task={task}
      index={doneCount(view.tasks) + 1}
      total={view.tasks.length}
      onSaved={(title, next) => setSaved({ title, view: next })}
    />
  )
}