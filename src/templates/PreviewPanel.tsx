import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import QuestionRenderer from '../careers/QuestionRenderer'
import type { Answers } from '../careers/types'
import { toCandidateQuestions } from './logic'
import type { TemplateQuestion } from './types'

export default function PreviewPanel({ questions }: { questions: TemplateQuestion[] }) {
  const { t } = useTranslation('templates')
  const [answers, setAnswers] = useState<Answers>({})
  const candidateQuestions = toCandidateQuestions(questions)

  return (
    <section
      aria-label={t('preview.title')}
      className="flex flex-col gap-4 rounded-lg border-2 border-dashed p-4"
    >
      <h2 className="text-lg font-semibold">{t('preview.title')}</h2>
      <p className="text-sm opacity-80">{t('preview.note')}</p>
      {candidateQuestions.map(q => (
        <QuestionRenderer
          key={q.id}
          question={q}
          value={answers[q.id]}
          onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
        />
      ))}
    </section>
  )
}