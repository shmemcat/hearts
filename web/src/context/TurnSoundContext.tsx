import {
   createContext,
   useContext,
   useEffect,
   useRef,
   useState,
   type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useSound } from "@/context/SoundContext";
import { sharedAccountRequest } from "@/lib/sharedAccount";
import styles from "@/styles/turn-sound.module.css";

type TurnSoundState = {
   enabled: boolean;
   saving: boolean;
   error: string;
   available: boolean;
   setEnabled: (enabled: boolean) => Promise<void>;
};
const Context = createContext<TurnSoundState>({
   enabled: false,
   saving: false,
   error: "",
   available: false,
   setEnabled: async () => {},
});

export function TurnSoundProvider({ children }: { children: ReactNode }) {
   const { user, status, updateUser } = useAuth();
   const loading = status === "loading";
   return (
      <AccountTurnSound
         accountId={user?.id ?? "guest"}
         enabled={!!user && !loading && user.turn_sound?.hearts === true}
         available={!!user && !loading}
         save={async (enabled) => {
            const next = await sharedAccountRequest(
               "profile",
               { turn_sound: { game: "hearts", enabled } },
               user!.id
            );
            if (next.user) updateUser({ turn_sound: next.user.turn_sound });
         }}
      >
         {children}
      </AccountTurnSound>
   );
}

function AccountTurnSound({
   children,
   enabled,
   available,
   accountId,
   save,
}: {
   children: ReactNode;
   enabled: boolean;
   available: boolean;
   accountId: string;
   save: (enabled: boolean) => Promise<unknown>;
}) {
   const [operation, setOperation] = useState({
      accountId,
      saving: false,
      error: "",
      value: enabled,
   });
   const pending = useRef<string | null>(null);
   const currentAccount = useRef(accountId);
   currentAccount.current = accountId;
   const setEnabled = async (value: boolean) => {
      if (!available || pending.current === accountId) return;
      pending.current = accountId;
      setOperation({ accountId, saving: true, error: "", value });
      try {
         await save(value);
         if (currentAccount.current === accountId)
            setOperation({ accountId, saving: false, error: "", value });
      } catch (error) {
         if (currentAccount.current === accountId)
            setOperation({
               accountId,
               saving: false,
               value: enabled,
               error:
                  error instanceof Error
                     ? error.message
                     : "Unable to save your option.",
            });
      } finally {
         if (pending.current === accountId) pending.current = null;
      }
   };
   const saving = operation.accountId === accountId && operation.saving;
   const error = operation.accountId === accountId ? operation.error : "";
   const checked = available && (saving ? operation.value : enabled);
   return (
      <Context.Provider
         value={{ enabled: checked, available, saving, error, setEnabled }}
      >
         {children}
      </Context.Provider>
   );
}

export function TurnSoundOption() {
   const { enabled, available, saving, error, setEnabled } =
      useContext(Context);
   return (
      <section className={styles.section}>
         <h2>Turn Indicator</h2>
         <label className={styles.option}>
            <input
               type="checkbox"
               checked={enabled}
               disabled={!available || saving}
               onChange={(event) => void setEnabled(event.target.checked)}
            />
            <span>Play a sound when it’s my turn</span>
         </label>
         {!available && <p>Sign in to enable the turn indicator.</p>}
         {error && <p role="alert">{error}</p>}
      </section>
   );
}

// Record every decision, including while opted out or muted. Re-renders,
// reconnects and temporary input locks must not replay the same turn.
export function useTurnIndicator(canAct: boolean, decision: string) {
   const { enabled } = useContext(Context);
   const { play } = useSound();
   const lastDecision = useRef<string | null>(null);
   useEffect(() => {
      if (!canAct || !decision || decision === lastDecision.current) return;
      lastDecision.current = decision;
      if (enabled) play("turn");
   }, [canAct, decision, enabled, play]);
}
