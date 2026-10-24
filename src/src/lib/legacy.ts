// Compatibility with saved data from before the Jobbery rename. Never use this
// name for new branding; existing identity hashes and saved records must stay stable.
const LEGACY_NAME = "runway";
export const legacyKey = (key: string) => key.replace(/^jobbery/, LEGACY_NAME);

export const readStored = (storage: Storage, key: string) =>
  storage.getItem(key) ?? storage.getItem(legacyKey(key));

export const removeStored = (storage: Storage, key: string) => {
  storage.removeItem(key);
  storage.removeItem(legacyKey(key));
};
