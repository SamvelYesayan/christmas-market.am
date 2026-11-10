// The Winter Quiz — the server holds the answers and checks each one in order.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { Art } from '@/components/Art';
import { CouponTicket, SignInGate } from '@/components/Common';
import { celebrate } from '@/components/Celebration';
import type { QuizAnswer, QuizStart } from '@/api/types';

export default function Quiz() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [quiz, setQuiz] = useState<QuizStart | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<(QuizAnswer & { chosen: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try { setQuiz(await api.games.quizStart()); setI(0); setAnswer(null); } catch (e) { toast((e as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };
  const choose = async (idx: number) => {
    if (answer || busy || !quiz) return;
    setBusy(true);
    try {
      const q = quiz.questions[i];
      const r = await api.games.quizAnswer(quiz.sessionId, q.id, idx);
      setAnswer({ ...r, chosen: idx });
      if (r.correct) haptic.success(); else haptic.warning();
      if (r.done) {
        celebrate(r.reward, r.achievement);
        if (r.bonus) setTimeout(() => celebrate(r.bonus), 1400);
        void qc.invalidateQueries({ queryKey: ['games'] });
        void qc.invalidateQueries({ queryKey: ['challenges'] });
      }
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally { setBusy(false); }
  };
  const q = quiz?.questions[i];
  if (!signedIn) return <Screen back title={t('games.quiz.title')}><SignInGate body={t('games.signInBody')} next="/games/quiz" /></Screen>;
  return (
    <Screen back title={t('games.quiz.title')}>
      {!quiz || !q ? (
        <Card style={{ alignItems: 'center', gap: space.lg }}>
          <View style={{ width: 120, height: 120 }}><Art art={{ type: 'book', c1: '#7a2a1e' }} /></View>
          <Text align="center" tone="muted">{t('games.quiz.intro')}</Text>
          <Button label={t('games.quiz.open')} loading={busy} onPress={start} />
        </Card>
      ) : (
        <Animated.View key={i} entering={FadeInRight.duration(260)} style={{ gap: space.lg }}>
          <Text variant="eyebrow" tone="accent">{t('games.quiz.q', { i: i + 1, n: quiz.questions.length })}</Text>
          <Text variant="heading">{q.question}</Text>
          <View style={{ gap: space.sm }}>
            {q.options.map((o, k) => {
              const right = answer && k === answer.correctIndex;
              const wrong = answer && k === answer.chosen && !answer.correct;
              return (
                <Pressable key={k} accessibilityRole="button" accessibilityState={{ disabled: !!answer || busy, selected: answer?.chosen === k }} disabled={!!answer || busy} onPress={() => choose(k)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: right ? colors.success : wrong ? colors.danger : colors.border, backgroundColor: colors.surface, opacity: answer && !right && !wrong ? 0.5 : 1 }}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{o}</Text>
                  {right ? <Icon name="check" color={colors.success} /> : wrong ? <Icon name="close" color={colors.danger} /> : null}
                </Pressable>
              );
            })}
          </View>
          {answer ? (
            <Card tone="paper" style={{ gap: space.md }}>
              <Text tone="paper"><Text variant="bodyStrong" tone="paper">{answer.correct ? t('games.quiz.correct') : t('games.quiz.wrong')}</Text> {answer.funFact}</Text>
              {answer.done ? (
                <>
                  <Text variant="heading" tone="paper">{t('games.quiz.scored', { s: answer.score, n: answer.total })}</Text>
                  {answer.reward ? <Text variant="bodyStrong" tone="paper">+{answer.reward.points} {t('common.stardust')}</Text> : null}
                  {answer.bonus?.couponCode ? <CouponTicket code={answer.bonus.couponCode} title={t('games.quiz.perfect')} /> : null}
                  <Text variant="caption" tone="paperMuted">{t('games.quiz.tomorrow')}</Text>
                </>
              ) : <Button variant="paper" label={t('games.quiz.next')} onPress={() => { setI(i + 1); setAnswer(null); }} />}
            </Card>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}
