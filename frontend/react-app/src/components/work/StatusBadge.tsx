import { useI18n } from '../../i18n/I18nContext.js';
import { workStatusClass, workStatusLabel } from '../../lib/work-status.js';

export function StatusBadge({ status }: { status: string }) {
  const { msg } = useI18n();
  return <span className={workStatusClass(status)}>{workStatusLabel(status, msg)}</span>;
}
