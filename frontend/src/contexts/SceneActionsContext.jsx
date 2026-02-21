import { createContext, useContext } from 'react';

export const SceneActionsContext = createContext({
  regenImage: null,
  regenScene: null,
  deleteScene: null,
  sceneBusy: new Set(),
  isReadOnly: false,
});

export function useSceneActions() {
  return useContext(SceneActionsContext);
}
