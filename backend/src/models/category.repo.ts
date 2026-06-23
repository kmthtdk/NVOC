import { pool } from '../config/db.js';
import type { CategoryRow, SubcategoryRow, RequestTypeRow } from './rows.js';
import type { CategorySpec } from '../types/index.js';

/**
 * Loads the full 3-level taxonomy and assembles the nested CategorySpec[] shape
 * the frontend form consumes (category -> subcategories -> types{+period}).
 * Three flat queries + in-memory grouping (cheap; taxonomy is small & static).
 */
export const categoryRepo = {
  async getTaxonomy(): Promise<CategorySpec[]> {
    const [cats] = await pool.query<CategoryRow[]>(
      'SELECT * FROM categories ORDER BY sort_order, name',
    );
    const [subs] = await pool.query<SubcategoryRow[]>(
      'SELECT * FROM subcategories ORDER BY sort_order, name',
    );
    const [types] = await pool.query<RequestTypeRow[]>(
      'SELECT * FROM request_types ORDER BY sort_order, name',
    );

    const typesBySub = new Map<string, RequestTypeRow[]>();
    for (const t of types) {
      const list = typesBySub.get(t.subcategory_id) ?? [];
      list.push(t);
      typesBySub.set(t.subcategory_id, list);
    }

    const subsByCat = new Map<string, SubcategoryRow[]>();
    for (const s of subs) {
      const list = subsByCat.get(s.category_id) ?? [];
      list.push(s);
      subsByCat.set(s.category_id, list);
    }

    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description ?? '',
      subcategories: (subsByCat.get(c.id) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        types: (typesBySub.get(s.id) ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          period: t.period_required,
        })),
      })),
    }));
  },

  /** Look up a single request type (used to enforce the period rule on create). */
  async findType(typeId: string): Promise<RequestTypeRow | null> {
    const [rows] = await pool.query<RequestTypeRow[]>(
      'SELECT * FROM request_types WHERE id = ? LIMIT 1',
      [typeId],
    );
    return rows[0] ?? null;
  },
};
