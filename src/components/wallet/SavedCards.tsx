import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Check, CreditCard, Plus, Trash2 } from 'lucide-react-native';
import { Button, IconButton, Tap } from '../ui/Button';
import { Card, Divider, Row, SectionHeader } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { cardLabel, listSavedCards, removeSavedCard, SavedCard, WompiConfig, wompiConfig } from '../../lib/wompi';
import { colors, space } from '../../theme/tokens';
import { AddCardSheet } from './AddCardSheet';

/**
 * Wallet: the user's saved cards (Wompi): passengers pay trips and drivers top up with one tap.
 * Optional: `tone="dark"` for the driver app, and a selectable mode (`selectedId` + `onSelect`)
 * to choose the card a payment uses; `onCardsChange` reports the list whenever it changes.
 */
export function SavedCards({
  tone = 'light',
  title,
  selectedId,
  onSelect,
  onCardsChange,
}: {
  tone?: 'light' | 'dark';
  title?: string;
  selectedId?: string | null;
  onSelect?: (card: SavedCard) => void;
  onCardsChange?: (cards: SavedCard[]) => void;
} = {}) {
  const t = useT();
  const toast = useToast();
  const dark = tone === 'dark';
  const [cfg, setCfg] = useState<WompiConfig | null>(null);
  const [cards, setCardsState] = useState<SavedCard[]>([]);
  const [adding, setAdding] = useState(false);
  const changed = useRef(onCardsChange);
  useEffect(() => {
    changed.current = onCardsChange;
  });
  const setCards = useCallback((list: SavedCard[]) => {
    setCardsState(list);
    changed.current?.(list);
  }, []);

  const reload = useCallback((c: WompiConfig) => listSavedCards(c.live).then(setCards).catch(() => undefined), [setCards]);
  useEffect(() => {
    wompiConfig()
      .then((c) => {
        setCfg(c);
        if (c.savedCards) reload(c);
      })
      .catch(() => undefined);
  }, [reload]);

  if (!cfg?.savedCards) return null;

  const remove = async (card: SavedCard) => {
    await removeSavedCard(card.id).catch(() => undefined);
    setCards(cards.filter((c) => c.id !== card.id));
    toast(t('cards.removed'));
  };

  return (
    <>
      <SectionHeader tone={dark ? 'dark' : 'light'} title={title ?? t('cards.title')} style={{ marginTop: space[6] }} />
      <Card tone={dark ? 'dark' : 'light'} padded={false} style={{ paddingHorizontal: space[4] }}>
        {cards.map((c, i) => {
          const selected = !!onSelect && selectedId === c.id;
          const row = (
            <Row style={{ paddingVertical: 14, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: dark ? colors.midnight600 : colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={20} color={colors.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" color={dark ? colors.ivory : colors.ink}>
                  {cardLabel(c)}
                </Txt>
                {c.exp_month && c.exp_year ? (
                  <Txt v="caption" color={dark ? colors.onDarkMuted : colors.inkMuted}>
                    {t('cards.expires', { date: `${String(c.exp_month).padStart(2, '0')}/${String(c.exp_year).slice(-2)}` })}
                  </Txt>
                ) : null}
              </View>
              {onSelect ? (
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.lime : dark ? colors.lineDarkStrong : colors.lineLightStrong, backgroundColor: selected ? colors.lime : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {selected ? <Check size={14} color={colors.midnight} strokeWidth={3} /> : null}
                </View>
              ) : null}
              <IconButton icon={Trash2} label={t('cards.remove')} tone={dark ? 'clearDark' : 'light'} onPress={() => remove(c)} />
            </Row>
          );
          return (
            <View key={c.id}>
              {i ? <Divider tone={dark ? 'dark' : 'light'} inset={58} /> : null}
              {onSelect ? (
                <Tap onPress={() => onSelect(c)} scaleTo={0.99} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={cardLabel(c)}>
                  {row}
                </Tap>
              ) : (
                row
              )}
            </View>
          );
        })}
        <View style={{ paddingVertical: 14 }}>
          {!cards.length ? (
            <Txt v="small" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ marginBottom: 12 }}>
              {t('cards.empty')}
            </Txt>
          ) : null}
          <Button label={t('cards.add')} icon={Plus} variant={dark ? 'outlineDark' : 'outline'} size="md" onPress={() => setAdding(true)} />
        </View>
      </Card>
      <AddCardSheet
        visible={adding}
        config={cfg}
        onClose={() => setAdding(false)}
        onSaved={(card) => {
          setAdding(false);
          setCards([card, ...cards]);
          onSelect?.(card);
          toast(t('cards.saved', { card: cardLabel(card) }));
        }}
      />
    </>
  );
}
