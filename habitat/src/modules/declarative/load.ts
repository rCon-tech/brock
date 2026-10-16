import { parseMdl, type MdlModule } from './mdl-schema';

/** Validate an MDL document. The server registry uses `.manifest`; the UI registry also renders `.views`. */
export function loadMdl(doc: unknown): MdlModule {
  return parseMdl(doc);
}
