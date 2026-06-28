import type { components } from '@shell/api/schema.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';

type Actor = components['schemas']['Actor'];
type ActorModel = components['schemas']['ActorModel'];

function attr(actor: Actor, key: string): string | undefined {
  const value = actor.attributes?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Human-readable label for an actor: prefers name attributes, then a model
 * label, and finally a shortened id. Never returns a bare UUID where avoidable.
 */
export function actorLabel(
  actor: Actor,
  modelLabels: Map<string, string>,
  locale: string,
): string {
  const company = attr(actor, 'company') ?? attr(actor, 'organization');
  const nameParts = [attr(actor, 'first_name'), attr(actor, 'name') ?? attr(actor, 'last_name')]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (nameParts) {
    return company ? `${nameParts} (${company})` : nameParts;
  }
  if (company) return company;

  const email = attr(actor, 'email');
  if (email) return email;

  const modelLabel = modelLabels.get(actor.actor_model_id);
  if (modelLabel) return `${modelLabel} · ${actor.id.slice(0, 8)}`;

  return actor.id.slice(0, 8);
}

export function buildActorModelLabels(
  models: ActorModel[],
  locale: 'de' | 'en',
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of models) {
    map.set(m.id, m.display_name ?? labelFromTranslations(m.translations, m.key, locale));
  }
  return map;
}
