import { useState } from 'react';
import { BUILT_IN_SCENE_STYLES, type SceneStyle } from '@engine/sceneStyles';
import { LAYOUT_LABELS } from '@engine/sceneBuilder';
import { useAppStore } from '../store/useAppStore';
import { Group } from './ui';

interface Props {
  sceneId: string;
  disabled: boolean;
  onNotice: (msg: string) => void;
}

/** Scene panel group: apply a built-in or saved Scene Style, or save this scene as a new style. */
export function SceneStylesGroup({ sceneId, disabled, onNotice }: Props) {
  const myStyles = useAppStore((s) => s.sceneStyles);
  const applySceneStyle = useAppStore((s) => s.applySceneStyle);
  const saveSceneStyle = useAppStore((s) => s.saveSceneStyle);
  const deleteSceneStyle = useAppStore((s) => s.deleteSceneStyle);
  const [nameDraft, setNameDraft] = useState('');

  const apply = (style: SceneStyle) => {
    if (applySceneStyle(sceneId, style.id)) onNotice(`Đã áp Scene Style: ${style.name}`);
  };

  const tile = (style: SceneStyle) => (
    <div key={style.id} className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => apply(style)}
        title={style.desc ?? `${LAYOUT_LABELS[style.settings.layout]} • ${style.settings.durationSec}s`}
        className="flex h-12 w-full flex-col justify-center rounded border border-zinc-800 bg-zinc-900/90 px-2 text-left hover:border-amber-400 disabled:opacity-40"
      >
        <span className="truncate text-xs font-medium text-zinc-100">
          {style.builtIn ? '' : '★ '}
          {style.name}
        </span>
        <span className="truncate text-2xs text-zinc-500">
          {LAYOUT_LABELS[style.settings.layout]} • {style.settings.durationSec}s
        </span>
      </button>
      {!style.builtIn && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => deleteSceneStyle(style.id)}
          title="Xóa style này"
          className="absolute top-0.5 right-1 hidden h-5 w-5 rounded text-zinc-500 group-hover:block hover:text-red-400"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <Group id="scene-styles" title="Scene Style (mẫu scene)" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-1.5">
        {BUILT_IN_SCENE_STYLES.map(tile)}
        {myStyles.map(tile)}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={nameDraft}
          disabled={disabled}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Tên style (VD: Cổng hoa)"
          className="h-8 min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
        />
        <button
          type="button"
          disabled={disabled || !nameDraft.trim()}
          onClick={() => {
            if (saveSceneStyle(sceneId, nameDraft)) {
              onNotice(`Đã lưu Scene Style: ${nameDraft.trim()}`);
              setNameDraft('');
            }
          }}
          className="h-8 rounded bg-amber-500 px-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          Lưu scene này
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Áp style đổi bố cục, thời lượng, chuyển động, nền, khung ảnh, chuyển cảnh và thời điểm chữ; giữ nguyên ảnh và
        nội dung chữ của scene. Style của bạn lưu trên máy này.
      </p>
    </Group>
  );
}
