import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useId,
   useRef,
   useState,
   type ReactNode,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlay } from "@fortawesome/pro-solid-svg-icons";
import { useAuth } from "@/context/AuthContext";
import { sharedAccountRequest } from "@/lib/sharedAccount";
import {
   createTurnSoundPlayer,
   DEFAULT_TURN_SOUND,
   normalizeTurnSound,
   TURN_SOUNDS,
   type TurnSoundOptions,
   type TurnSoundUpdate,
} from "@/lib/turnSound";
import buttons from "@/styles/buttons.module.css";
import styles from "@/styles/turn-sound.module.css";

type Options = TurnSoundOptions & { enabled: boolean };
type TurnSoundState = Options & {
   saving: boolean;
   error: string;
   available: boolean;
   update: (value: TurnSoundUpdate) => Promise<void>;
   preview: (volume: number) => void;
   setPlaybackVolume: (volume: number) => void;
   playIndicator: () => void;
};
const Context = createContext<TurnSoundState>({
   ...DEFAULT_TURN_SOUND,
   enabled: false,
   saving: false,
   error: "",
   available: false,
   update: async () => {},
   preview: () => {},
   setPlaybackVolume: () => {},
   playIndicator: () => {},
});

export function TurnSoundProvider({ children }: { children: ReactNode }) {
   const { user, status, updateUser } = useAuth();
   const loading = status === "loading";
   const activeAccount = useRef(user?.id);
   activeAccount.current = user?.id;
   return (
      <AccountTurnSound
         accountId={user?.id ?? "guest"}
         value={{
            ...normalizeTurnSound(user?.turn_sound_options?.hearts),
            enabled: !!user && !loading && user.turn_sound?.hearts === true,
         }}
         available={!!user && !loading}
         save={async (patch) => {
            const next = await sharedAccountRequest(
               "profile",
               { turn_sound: { game: "hearts", ...patch } },
               user!.id
            );
            if (next.user && activeAccount.current === user!.id)
               updateUser({
                  turn_sound: next.user.turn_sound,
                  turn_sound_options: next.user.turn_sound_options,
               });
         }}
      >
         {children}
      </AccountTurnSound>
   );
}

function AccountTurnSound({
   children,
   value,
   available,
   accountId,
   save,
}: {
   children: ReactNode;
   value: Options;
   available: boolean;
   accountId: string;
   save: (value: TurnSoundUpdate) => Promise<unknown>;
}) {
   const [operation, setOperation] = useState({
      accountId,
      value,
      saving: false,
      error: "",
   });
   const [player] = useState(createTurnSoundPlayer);
   const [previewError, setPreviewError] = useState("");
   const pending = useRef<{ accountId: string } | null>(null);
   const currentAccount = useRef(accountId);
   currentAccount.current = accountId;
   const owned = operation.accountId === accountId;
   const options = owned ? operation.value : value;
   const enabled = available && options.enabled;
   const saving = owned && operation.saving;
   const error = owned ? operation.error || previewError : "";

   useEffect(() => {
      if (pending.current?.accountId !== accountId)
         setOperation({ accountId, value, saving: false, error: "" });
   }, [accountId, value.enabled, value.sound, value.volume]);
   useEffect(() => {
      player.stop();
      setPreviewError("");
   }, [accountId, player]);
   useEffect(() => {
      if (!enabled) {
         player.stop();
      }
   }, [enabled, player]);
   useEffect(() => () => player.stop(), [player]);

   const update = async (patch: TurnSoundUpdate) => {
      if (!available || pending.current?.accountId === accountId) return;
      const request = { accountId };
      pending.current = request;
      const next = { ...options, ...patch };
      player.stop();
      setPreviewError("");
      setOperation({ accountId, value: next, saving: true, error: "" });
      try {
         await save(patch);
         if (
            currentAccount.current === accountId &&
            pending.current === request
         )
            setOperation({ accountId, value: next, saving: false, error: "" });
      } catch (error) {
         if (
            currentAccount.current === accountId &&
            pending.current === request
         )
            setOperation({
               accountId,
               value: options,
               saving: false,
               error:
                  error instanceof Error
                     ? error.message
                     : "Unable to save your option.",
            });
      } finally {
         if (pending.current === request) pending.current = null;
      }
   };
   const preview = (volume: number) => {
      if (!enabled) return;
      setPreviewError("");
      player.play(options.sound, volume, undefined, () => {
         if (currentAccount.current === accountId)
            setPreviewError("Unable to preview this sound. Please try again.");
      });
   };
   const playIndicator = useCallback(() => {
      if (enabled && options.volume > 0)
         player.play(options.sound, options.volume);
   }, [enabled, options.sound, options.volume, player]);
   return (
      <Context.Provider
         value={{
            ...options,
            enabled,
            available,
            saving,
            error,
            update,
            preview,
            playIndicator,
            setPlaybackVolume: player.setVolume,
         }}
      >
         {children}
      </Context.Provider>
   );
}

export function TurnSoundOption() {
   const {
      enabled,
      sound,
      volume,
      available,
      saving,
      error,
      update,
      preview,
      setPlaybackVolume,
   } = useContext(Context);
   const volumeId = useId();
   const [draftVolume, setDraftVolume] = useState(volume);
   useEffect(() => setDraftVolume(volume), [volume]);
   const saveVolume = () => {
      if (draftVolume !== volume && !saving)
         void update({ volume: draftVolume });
   };
   return (
      <section className={styles.section} aria-label="Turn indicator">
         <h2>Turn Indicator</h2>
         <label className={styles.option}>
            <input
               type="checkbox"
               checked={enabled}
               disabled={!available || saving}
               onChange={(event) =>
                  void update({ enabled: event.target.checked })
               }
            />
            <span>Play a sound when it’s my turn</span>
         </label>
         {enabled && (
            <div className={styles.controls}>
               <div className={styles.selectorRow}>
                  <div className={styles.selectWrap}>
                     <select
                        aria-label="Turn indicator sound"
                        value={sound}
                        disabled={saving}
                        onChange={(event) =>
                           void update({
                              sound: event.target
                                 .value as TurnSoundOptions["sound"],
                           })
                        }
                     >
                        {TURN_SOUNDS.map((option) => (
                           <option key={option.value} value={option.value}>
                              {option.label}
                           </option>
                        ))}
                     </select>
                     <FontAwesomeIcon
                        icon={faChevronDown}
                        className={styles.chevron}
                     />
                  </div>
                  <button
                     type="button"
                     className={`${buttons["menu-button"]} ${styles.preview}`}
                     onClick={() => preview(draftVolume)}
                     aria-label="Preview sound"
                  >
                     <span
                        className={buttons["button-shine"]}
                        aria-hidden="true"
                     />
                     <FontAwesomeIcon icon={faPlay} />
                     <span>Preview</span>
                  </button>
               </div>
               <div className={styles.volume}>
                  <div className={styles.volumeHeading}>
                     <label htmlFor={volumeId}>Turn sound volume</label>
                     <output htmlFor={volumeId}>
                        {Math.round(draftVolume * 100)}%
                     </output>
                  </div>
                  <input
                     id={volumeId}
                     type="range"
                     min="0"
                     max="100"
                     step="1"
                     value={Math.round(draftVolume * 100)}
                     disabled={saving}
                     onChange={(event) => {
                        const level = Number(event.target.value) / 100;
                        setDraftVolume(level);
                        setPlaybackVolume(level);
                     }}
                     onPointerUp={saveVolume}
                     onKeyUp={saveVolume}
                     onBlur={saveVolume}
                  />
               </div>
            </div>
         )}

         {error && <p role="alert">{error}</p>}
      </section>
   );
}

// Record decisions even while opted out or silent, so edits and reconnections
// cannot replay a turn that has already been announced.
export function useTurnIndicator(canAct: boolean, decision: string) {
   const { playIndicator } = useContext(Context);
   const lastDecision = useRef<string | null>(null);
   useEffect(() => {
      if (!canAct || !decision || decision === lastDecision.current) return;
      lastDecision.current = decision;
      playIndicator();
   }, [canAct, decision, playIndicator]);
}
