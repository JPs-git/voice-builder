import { Modal } from '../Modal'
import { TrainingGoalCard } from './TrainingGoalCard'

interface TrainingGoalModalProps {
  open: boolean
  onClose: () => void
}

export function TrainingGoalModal({ open, onClose }: TrainingGoalModalProps) {
  return (
    <Modal open={open} title="训练目标" onClose={onClose}>
      <TrainingGoalCard />
    </Modal>
  )
}
