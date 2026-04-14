import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView,
  Platform, Animated, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { useProfile } from '@/contexts/ProfileContext';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { getInsight } from '@/lib/anthropic';
import Anthropic from '@anthropic-ai/sdk';

type SubTab = 'shopping' | 'planner' | 'recipes';

type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  unit?: string;
  store?: string;
  checked: boolean;
  recurring: boolean;
  source: string;
};

type MealSlot = { id?: string; day_of_week: number; meal_type: 'breakfast' | 'lunch' | 'dinner'; custom_meal?: string };

type Recipe = {
  id: string;
  title: string;
  description?: string;
  ingredients?: string;
  instructions?: string;
  prep_time?: number;
  servings?: number;
  tags?: string;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_EMOJI: Record<string, string> = { breakfast: '☀️', lunch: '🌤️', dinner: '🌙' };

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export default function MealsScreen() {
  const { profile, theme } = useProfile();
  const [activeTab, setActiveTab] = useState<SubTab>('shopping');

  // Shopping
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [smartAddModal, setSmartAddModal] = useState(false);
  const [voiceModal, setVoiceModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: '', store: '' });
  const [smartText, setSmartText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Planner
  const [mealSlots, setMealSlots] = useState<Record<string, string>>({});
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; type: string } | null>(null);
  const [mealInput, setMealInput] = useState('');
  const [generatingMeals, setGeneratingMeals] = useState(false);

  // Recipes
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeModal, setRecipeModal] = useState(false);
  const [viewRecipeModal, setViewRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipePrompt, setRecipePrompt] = useState('');
  const [generatingRecipe, setGeneratingRecipe] = useState(false);

  // Store recommendations
  const [storeModal, setStoreModal] = useState(false);
  const [storeLocation, setStoreLocation] = useState('');
  const [storeRecs, setStoreRecs] = useState('');
  const [loadingStores, setLoadingStores] = useState(false);

  // AI
  const [insight, setInsight] = useState('Plan your week in advance to save time and money. Use Smart Add to add multiple items at once.');
  const [insightLoading, setInsightLoading] = useState(false);

  const weekStart = getWeekStart();

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('shopping_items').select('*')
      .eq('user_profile', profile)
      .order('created_at', { ascending: false });
    if (data) setItems(data as ShoppingItem[]);
  }, [profile]);

  const loadMeals = useCallback(async () => {
    const { data } = await supabase
      .from('meal_slots').select('*')
      .eq('user_profile', profile)
      .eq('week_start', weekStart);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[`${s.day_of_week}-${s.meal_type}`] = s.custom_meal ?? ''; });
      setMealSlots(map);
    }
  }, [profile, weekStart]);

  const loadRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes').select('*')
      .eq('user_profile', profile)
      .order('created_at', { ascending: false });
    if (data) setRecipes(data as Recipe[]);
  }, [profile]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadMeals(); }, [loadMeals]);
  useEffect(() => { if (activeTab === 'recipes') loadRecipes(); }, [activeTab, loadRecipes]);

  useEffect(() => {
    if (activeTab !== 'shopping') return;
    let cancelled = false;
    async function load() {
      setInsightLoading(true);
      try {
        const unchecked = items.filter(i => !i.checked).map(i => i.name);
        const text = await getInsight({ screen: 'meals', data: { items: unchecked.slice(0, 8) } });
        if (!cancelled) setInsight(text);
      } catch { /* keep default */ }
      finally { if (!cancelled) setInsightLoading(false); }
    }
    if (items.length > 0) load();
    return () => { cancelled = true; };
  }, [activeTab, items.length]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access in Settings.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Could not start recording', String(e));
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      // Transfer dictated text from voiceText state to smartText and open Smart Add
      if (voiceText.trim()) {
        setSmartText(voiceText);
        setVoiceText('');
        setVoiceModal(false);
        setSmartAddModal(true);
      }
    } catch { /* ignore */ }
  }

  async function smartAdd() {
    if (!smartText.trim()) return;
    setSmartLoading(true);
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Parse this grocery list text into structured items.
Text: "${smartText}"
Return ONLY a JSON array. Example: [{"name":"whole milk","quantity":"2","unit":"gallons"},{"name":"eggs","quantity":"12","unit":""}]
Extract every item mentioned. If no quantity, use "1".`,
        }],
      });
      const content = res.content[0];
      if (content.type === 'text') {
        const match = content.text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed: Array<{ name: string; quantity: string; unit: string }> = JSON.parse(match[0]);
          for (const item of parsed) {
            await supabase.from('shopping_items').insert({
              user_profile: profile,
              name: item.name,
              quantity: item.quantity || null,
              unit: item.unit || null,
              source: 'smart_add',
              checked: false,
              recurring: false,
            });
          }
          setSmartText('');
          setSmartAddModal(false);
          loadItems();
          return;
        }
      }
      Alert.alert('Could not parse', 'Try typing items like: "2 gallons milk, dozen eggs, bread"');
    } catch {
      Alert.alert('Error', 'Could not add items. Check your internet connection.');
    } finally {
      setSmartLoading(false);
    }
  }

  async function addItem() {
    if (!newItem.name.trim()) return;
    await supabase.from('shopping_items').insert({
      user_profile: profile,
      name: newItem.name,
      quantity: newItem.quantity || null,
      unit: newItem.unit || null,
      store: newItem.store || null,
      checked: false,
      recurring: false,
      source: 'manual',
    });
    setNewItem({ name: '', quantity: '', unit: '', store: '' });
    setAddModalVisible(false);
    loadItems();
  }

  async function toggleItem(id: string, checked: boolean) {
    await supabase.from('shopping_items').update({ checked: !checked }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i));
  }

  async function deleteChecked() {
    const ids = items.filter(i => i.checked).map(i => i.id);
    if (ids.length === 0) return;
    await supabase.from('shopping_items').delete().in('id', ids);
    loadItems();
  }

  async function saveMealSlot() {
    if (!selectedSlot || !mealInput.trim()) return;
    const key = `${selectedSlot.day}-${selectedSlot.type}`;
    await supabase.from('meal_slots').upsert({
      user_profile: profile,
      week_start: weekStart,
      day_of_week: selectedSlot.day,
      meal_type: selectedSlot.type,
      custom_meal: mealInput,
    }, { onConflict: 'user_id,week_start,day_of_week,meal_type' });
    setMealSlots(prev => ({ ...prev, [key]: mealInput }));
    setMealInput('');
    setMealModalVisible(false);
  }

  async function generateWeekMeals() {
    setGeneratingMeals(true);
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Generate a healthy, budget-friendly weekly dinner plan for a Christian family.
Return ONLY a JSON object: {"0":"Chicken stir fry","1":"Pasta bolognese","2":"Baked salmon","3":"Beef tacos","4":"Vegetable soup","5":"Homemade pizza","6":"Pot roast"}
Keys 0=Mon through 6=Sun.`,
        }],
      });
      const content = res.content[0];
      if (content.type === 'text') {
        const match = content.text.match(/\{[\s\S]*\}/);
        if (match) {
          const meals: Record<string, string> = JSON.parse(match[0]);
          for (const [day, meal] of Object.entries(meals)) {
            await supabase.from('meal_slots').upsert({
              user_profile: profile,
              week_start: weekStart,
              day_of_week: parseInt(day),
              meal_type: 'dinner',
              custom_meal: meal,
            }, { onConflict: 'user_profile,week_start,day_of_week,meal_type' });
          }
          loadMeals();
        }
      }
    } catch { /* keep existing */ }
    finally { setGeneratingMeals(false); }
  }

  async function getStoreRecs() {
    if (!storeLocation.trim()) return;
    setLoadingStores(true);
    setStoreRecs('');
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const itemNames = items.filter(i => !i.checked).map(i => i.name).slice(0, 20);
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `I'm a budget-conscious home cook near ${storeLocation}.
My current shopping list: ${itemNames.length > 0 ? itemNames.join(', ') : 'general groceries'}.

Recommend the 3 best grocery stores near ${storeLocation} for a budget-conscious family. For each store:
- Name and why it's good for this list
- What they're best for (produce, meat, bulk, etc.)
- Estimated savings tip

Keep it practical and warm. If you don't know exact stores in that area, recommend the best national/regional chains that are commonly found there (Aldi, Kroger, Walmart, Publix, HEB, Trader Joe's, etc.) and explain which fits best for this list.`,
        }],
      });
      const content = res.content[0];
      if (content.type === 'text') setStoreRecs(content.text);
    } catch {
      setStoreRecs('Could not load recommendations. Check your internet connection.');
    } finally {
      setLoadingStores(false);
    }
  }

  async function generateRecipe() {
    if (!recipePrompt.trim()) return;
    setGeneratingRecipe(true);
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `Create a detailed recipe for a Christian home cook. Request: "${recipePrompt}"
Return ONLY valid JSON with no extra text before or after:
{"title":"Recipe Name","description":"One sentence description","prep_time":30,"servings":4,"ingredients":"1 cup flour\n2 eggs\n1 tsp salt","instructions":"1. Do first step.\n2. Do second step.\n3. Do third step.","tags":"easy, weeknight"}`,
        }],
      });
      const content = res.content[0];
      if (content.type !== 'text') throw new Error('No text response');

      // Extract JSON robustly
      let jsonStr = content.text.trim();
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in response');
      const recipe = JSON.parse(match[0]);

      if (!recipe.title) throw new Error('Recipe missing title');

      const { error: dbError } = await supabase.from('recipes').insert({
        user_profile: profile,
        title: String(recipe.title),
        description: recipe.description ? String(recipe.description) : null,
        prep_time: recipe.prep_time ? Number(recipe.prep_time) : null,
        servings: recipe.servings ? Number(recipe.servings) : null,
        ingredients: recipe.ingredients ? String(recipe.ingredients) : null,
        instructions: recipe.instructions ? String(recipe.instructions) : null,
        tags: recipe.tags ? String(recipe.tags) : null,
      });

      if (dbError) {
        Alert.alert('Save failed', `Could not save recipe: ${dbError.message}\n\nMake sure the recipes table exists in Supabase.`);
        return;
      }

      setRecipePrompt('');
      setRecipeModal(false);
      loadRecipes();
    } catch (e: any) {
      Alert.alert('Error', `Could not generate recipe: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setGeneratingRecipe(false);
    }
  }

  async function deleteRecipe(id: string) {
    await supabase.from('recipes').delete().eq('id', id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    if (selectedRecipe?.id === id) { setViewRecipeModal(false); setSelectedRecipe(null); }
  }

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'shopping', label: 'Shopping' },
    { key: 'planner', label: 'Planner' },
    { key: 'recipes', label: 'Recipes' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Meals</Text>
          <Text style={[styles.pageSub, { color: theme.textSub }]}>Planning & shopping</Text>
        </View>
      </View>

      <View style={[styles.subTabs, { backgroundColor: theme.surfaceAlt }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTab, activeTab === t.key && { backgroundColor: theme.surface }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.subTabText, { color: activeTab === t.key ? theme.text : theme.textSub }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── SHOPPING TAB ── */}
        {activeTab === 'shopping' && (
          <>
            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.voiceBtn, { backgroundColor: isRecording ? '#E53935' : theme.accent }]}
                  onPress={() => isRecording ? stopRecording() : setVoiceModal(true)}
                >
                  <Text style={styles.voiceBtnIcon}>{isRecording ? '⏹' : '🎤'}</Text>
                  <Text style={styles.voiceBtnText}>{isRecording ? 'Stop' : 'Voice'}</Text>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                style={[styles.smartBtn, { backgroundColor: theme.accent }]}
                onPress={() => setSmartAddModal(true)}
              >
                <Text style={styles.smartBtnIcon}>✦</Text>
                <Text style={styles.smartBtnText}>Smart Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={[styles.addBtnText, { color: theme.text }]}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.smartHint, { color: theme.textSub }]}>
              🎤 Voice: speak your list · ✦ Smart Add: type naturally
            </Text>

            {/* Store recommendations */}
            <TouchableOpacity
              style={[styles.storeRecBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => setStoreModal(true)}
            >
              <Text style={styles.storeRecEmoji}>🏪</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.storeRecTitle, { color: theme.text }]}>Where should I shop?</Text>
                <Text style={[styles.storeRecSub, { color: theme.textSub }]}>Get AI store picks for your area & list</Text>
              </View>
              <Text style={[{ color: theme.textSub, fontSize: 18 }]}>›</Text>
            </TouchableOpacity>

            {unchecked.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={`To get (${unchecked.length})`} />
                <Card noPad>
                  {unchecked.map((item, i) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemRow, { borderBottomColor: theme.borderLight }, i === unchecked.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => toggleItem(item.id, item.checked)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.check, { borderColor: theme.border }]} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                        {(item.quantity || item.unit) && (
                          <Text style={[styles.itemSub, { color: theme.textSub }]}>
                            {[item.quantity, item.unit].filter(Boolean).join(' ')}
                          </Text>
                        )}
                      </View>
                      {item.store && <Text style={[styles.itemStore, { color: theme.textSub }]}>{item.store}</Text>}
                    </TouchableOpacity>
                  ))}
                </Card>
              </View>
            )}

            {checked.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={`In cart (${checked.length})`} action="Clear" onAction={deleteChecked} />
                <Card noPad>
                  {checked.map((item, i) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemRow, { borderBottomColor: theme.borderLight, opacity: 0.5 }, i === checked.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => toggleItem(item.id, item.checked)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.check, { backgroundColor: theme.sage, borderColor: 'transparent' }]}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                      <Text style={[styles.itemName, { color: theme.text, textDecorationLine: 'line-through', marginLeft: 10 }]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              </View>
            )}

            {items.length === 0 && (
              <View style={[styles.emptyState, { marginHorizontal: 16, marginTop: 20 }]}>
                <Text style={styles.emptyEmoji}>🛒</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Shopping list is empty</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>Tap ✦ Smart Add to type your whole list at once, or + Manual for individual items</Text>
              </View>
            )}

            <AIInsightCard text={insight} loading={insightLoading} />
          </>
        )}

        {/* ── PLANNER TAB ── */}
        {activeTab === 'planner' && (
          <>
            <View style={[styles.plannerHeader, { paddingHorizontal: 16, marginTop: 14 }]}>
              <Text style={[styles.weekLabel, { color: theme.text }]}>This Week</Text>
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: theme.accent }]}
                onPress={generateWeekMeals}
                disabled={generatingMeals}
              >
                <Text style={styles.generateBtnText}>{generatingMeals ? '✨ Planning...' : '✨ AI Plan Week'}</Text>
              </TouchableOpacity>
            </View>

            {DAYS.map((day, dayIdx) => (
              <View key={day} style={[styles.plannerDayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.plannerDayLabel, { color: theme.accent }]}>{day}</Text>
                {MEAL_TYPES.map(type => {
                  const key = `${dayIdx}-${type}`;
                  const meal = mealSlots[key];
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.plannerMealRow, { borderTopColor: theme.borderLight }]}
                      onPress={() => {
                        setSelectedSlot({ day: dayIdx, type });
                        setMealInput(meal ?? '');
                        setMealModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.mealTypeEmoji}>{MEAL_EMOJI[type]}</Text>
                      <Text style={[styles.mealTypeLabel, { color: theme.textSub }]}>{type}</Text>
                      <Text style={[styles.mealName, { color: meal ? theme.text : theme.textMuted }]} numberOfLines={1}>
                        {meal || 'Tap to plan'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <AIInsightCard text="Plan dinners first, then work backwards to build your shopping list. Batch cooking on Sundays saves hours during the week." />
          </>
        )}

        {/* ── RECIPES TAB ── */}
        {activeTab === 'recipes' && (
          <>
            {/* AI Generate button */}
            <View style={[styles.recipeHero, { backgroundColor: theme.heroBackground }]}>
              <Text style={[styles.recipeHeroTitle, { color: theme.heroText }]}>Recipe Library</Text>
              <Text style={[styles.recipeHeroSub, { color: theme.heroSub }]}>Generate AI recipes and save your favorites</Text>
              <TouchableOpacity
                style={[styles.generateRecipeBtn, { backgroundColor: theme.accent }]}
                onPress={() => setRecipeModal(true)}
              >
                <Text style={styles.generateRecipeBtnText}>✦ Generate AI Recipe</Text>
              </TouchableOpacity>
            </View>

            {/* Recipe ideas chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ideaScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {['Easy weeknight chicken', 'Healthy breakfast muffins', 'Slow cooker pot roast', 'Sheet pan salmon', '30-min pasta', 'Bible-era lentil soup'].map(idea => (
                <TouchableOpacity
                  key={idea}
                  style={[styles.ideaChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => { setRecipePrompt(idea); setRecipeModal(true); }}
                >
                  <Text style={[styles.ideaChipText, { color: theme.text }]}>{idea}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {recipes.length === 0 ? (
              <View style={[styles.emptyState, { marginHorizontal: 16, marginTop: 12 }]}>
                <Text style={styles.emptyEmoji}>👩‍🍳</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No recipes yet</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>Tap a suggestion above or "Generate AI Recipe" to add your first recipe.</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <SectionHeader title={`Saved (${recipes.length})`} />
                <Card noPad>
                  {recipes.map((recipe, i) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[styles.recipeRow, { borderBottomColor: theme.borderLight }, i === recipes.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => { setSelectedRecipe(recipe); setViewRecipeModal(true); }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recipeTitle, { color: theme.text }]}>{recipe.title}</Text>
                        {recipe.description && (
                          <Text style={[styles.recipeDesc, { color: theme.textSub }]} numberOfLines={1}>{recipe.description}</Text>
                        )}
                        <View style={styles.recipeMeta}>
                          {recipe.prep_time && <Text style={[styles.recipeMetaText, { color: theme.textSub }]}>⏱ {recipe.prep_time} min</Text>}
                          {recipe.servings && <Text style={[styles.recipeMetaText, { color: theme.textSub }]}>🍽 {recipe.servings} servings</Text>}
                          <Text style={[styles.recipeMetaText, { color: theme.accent }]}>✦ AI</Text>
                        </View>
                      </View>
                      <Text style={{ color: theme.textSub, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── STORE RECS MODAL ── */}
      <Modal visible={storeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.recipeViewSafe, { backgroundColor: theme.background }]}>
          <View style={[styles.recipeViewHeader, { borderBottomColor: theme.borderLight }]}>
            <Text style={[styles.recipeViewTitle, { fontSize: 18, marginBottom: 0 }]}>🏪 Where to Shop</Text>
            <TouchableOpacity onPress={() => setStoreModal(false)}>
              <Text style={[{ color: theme.accent, fontSize: 15, fontWeight: '600' }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={[{ color: theme.textSub, fontSize: 14, marginBottom: 16, lineHeight: 21 }]}>
              Enter your city or zip code and Claude will recommend the best stores for your current shopping list.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>YOUR LOCATION</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="e.g. Nashville, TN or 37201"
                placeholderTextColor={theme.textMuted}
                value={storeLocation}
                onChangeText={setStoreLocation}
                returnKeyType="search"
                onSubmitEditing={getStoreRecs}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.promptSend, { backgroundColor: theme.accent, opacity: loadingStores ? 0.6 : 1 }]}
                onPress={getStoreRecs}
                disabled={loadingStores}
              >
                <Text style={styles.promptSendText}>{loadingStores ? '⏳' : '→'}</Text>
              </TouchableOpacity>
            </View>

            {items.filter(i => !i.checked).length > 0 && (
              <Text style={[{ color: theme.textSub, fontSize: 12, marginTop: 8 }]}>
                Matching against your {items.filter(i => !i.checked).length} item{items.filter(i => !i.checked).length !== 1 ? 's' : ''}
              </Text>
            )}

            {storeRecs ? (
              <View style={[styles.aiResult, { backgroundColor: theme.aiBackground, borderColor: theme.aiBorder, marginTop: 20 }]}>
                <Text style={[styles.aiResultText, { color: theme.text }]}>{storeRecs}</Text>
              </View>
            ) : !loadingStores && (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🛒</Text>
                <Text style={[{ color: theme.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 }]}>
                  Enter your location to get personalized store recommendations based on your shopping list.
                </Text>
              </View>
            )}
            {loadingStores && (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={[{ color: theme.textSub, fontSize: 14 }]}>Finding best stores near you...</Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── VOICE MODAL ── */}
      <Modal visible={voiceModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setVoiceModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎤 Voice Add</Text>
            <Text style={[styles.modalSub, { color: theme.textSub }]}>
              Tap the microphone on your keyboard and speak your items. Your words will appear below.
            </Text>

            <View style={[styles.voiceHintBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Text style={[styles.voiceHintText, { color: theme.textSub }]}>
                💡 Look for the <Text style={{ fontWeight: '700', color: theme.text }}>🎤 mic key</Text> on your iOS keyboard (bottom row, next to space bar)
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>YOUR ITEMS</Text>
            <TextInput
              style={[styles.smartInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="Tap mic on keyboard and speak, or type here..."
              placeholderTextColor={theme.textMuted}
              value={voiceText}
              onChangeText={setVoiceText}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              onPress={() => {
                if (!voiceText.trim()) return;
                setSmartText(voiceText);
                setVoiceText('');
                setVoiceModal(false);
                setSmartAddModal(true);
              }}
            >
              <Text style={styles.saveBtnText}>Parse & Add to List</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVoiceModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SMART ADD MODAL ── */}
      <Modal visible={smartAddModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSmartAddModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>✦ Smart Add</Text>
            <Text style={[styles.modalSub, { color: theme.textSub }]}>Type your items naturally — Claude will parse them into your list</Text>

            <TextInput
              style={[styles.smartInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder={'e.g. "2 gallons milk, dozen eggs, sourdough bread, 3 lbs chicken thighs, coffee"'}
              placeholderTextColor={theme.textMuted}
              value={smartText}
              onChangeText={setSmartText}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: smartLoading ? 0.7 : 1 }]}
              onPress={smartAdd}
              disabled={smartLoading}
            >
              <Text style={styles.saveBtnText}>{smartLoading ? 'Parsing items...' : 'Add to list'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSmartAddModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MANUAL ADD MODAL ── */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add item</Text>
            {[
              { label: 'ITEM NAME', key: 'name', placeholder: 'e.g. Whole milk' },
              { label: 'QUANTITY', key: 'quantity', placeholder: '2' },
              { label: 'UNIT', key: 'unit', placeholder: 'gallons, lbs, boxes...' },
              { label: 'STORE (OPTIONAL)', key: 'store', placeholder: 'Aldi, Kroger...' },
            ].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={[styles.inputLabel, { color: theme.textSub }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                  placeholder={placeholder}
                  placeholderTextColor={theme.textMuted}
                  value={(newItem as any)[key]}
                  onChangeText={v => setNewItem(p => ({ ...p, [key]: v }))}
                  returnKeyType={key === 'store' ? 'done' : 'next'}
                  onSubmitEditing={key === 'store' ? addItem : undefined}
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={addItem}>
              <Text style={styles.saveBtnText}>Add to list</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MEAL SLOT MODAL ── */}
      <Modal visible={mealModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMealModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedSlot ? `${DAYS[selectedSlot.day]} ${selectedSlot.type}` : 'Meal'}
            </Text>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>WHAT'S FOR {selectedSlot?.type?.toUpperCase()}?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Chicken stir fry"
              placeholderTextColor={theme.textMuted}
              value={mealInput}
              onChangeText={setMealInput}
              returnKeyType="done"
              onSubmitEditing={saveMealSlot}
              autoFocus
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={saveMealSlot}>
              <Text style={styles.saveBtnText}>Save meal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMealModalVisible(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── GENERATE RECIPE MODAL ── */}
      <Modal visible={recipeModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRecipeModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>✦ Generate Recipe</Text>
            <Text style={[styles.modalSub, { color: theme.textSub }]}>Describe what you'd like and Claude will create a full recipe</Text>
            <TextInput
              style={[styles.smartInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder={'e.g. "Easy weeknight chicken with vegetables, budget-friendly"'}
              placeholderTextColor={theme.textMuted}
              value={recipePrompt}
              onChangeText={setRecipePrompt}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: generatingRecipe ? 0.7 : 1 }]}
              onPress={generateRecipe}
              disabled={generatingRecipe}
            >
              <Text style={styles.saveBtnText}>{generatingRecipe ? 'Generating...' : 'Generate & Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRecipeModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── VIEW RECIPE MODAL ── */}
      <Modal visible={viewRecipeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.recipeViewSafe, { backgroundColor: theme.background }]}>
          <View style={[styles.recipeViewHeader, { borderBottomColor: theme.borderLight }]}>
            <TouchableOpacity onPress={() => setViewRecipeModal(false)}>
              <Text style={[styles.recipeViewBack, { color: theme.accent }]}>‹ Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => selectedRecipe && deleteRecipe(selectedRecipe.id)}>
              <Text style={{ color: '#E53935', fontSize: 13, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
          </View>
          {selectedRecipe && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.recipeViewContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.recipeViewTitle, { color: theme.text }]}>{selectedRecipe.title}</Text>
              {selectedRecipe.description && (
                <Text style={[styles.recipeViewDesc, { color: theme.textSub }]}>{selectedRecipe.description}</Text>
              )}
              <View style={styles.recipeStats}>
                {selectedRecipe.prep_time && (
                  <View style={[styles.recipeStat, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.recipeStatLabel, { color: theme.textSub }]}>PREP</Text>
                    <Text style={[styles.recipeStatVal, { color: theme.text }]}>{selectedRecipe.prep_time} min</Text>
                  </View>
                )}
                {selectedRecipe.servings && (
                  <View style={[styles.recipeStat, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.recipeStatLabel, { color: theme.textSub }]}>SERVES</Text>
                    <Text style={[styles.recipeStatVal, { color: theme.text }]}>{selectedRecipe.servings}</Text>
                  </View>
                )}
              </View>
              {selectedRecipe.ingredients && (
                <>
                  <Text style={[styles.recipeSection, { color: theme.text }]}>Ingredients</Text>
                  {selectedRecipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
                    <View key={i} style={styles.ingredientRow}>
                      <View style={[styles.ingredientDot, { backgroundColor: theme.accent }]} />
                      <Text style={[styles.ingredientText, { color: theme.text }]}>{line}</Text>
                    </View>
                  ))}
                </>
              )}
              {selectedRecipe.instructions && (
                <>
                  <Text style={[styles.recipeSection, { color: theme.text }]}>Instructions</Text>
                  <Text style={[styles.recipeInstructions, { color: theme.text }]}>{selectedRecipe.instructions}</Text>
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 18 },
  pageTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  pageSub: { fontSize: 12, marginTop: 2 },
  subTabs: { flexDirection: 'row', borderRadius: 12, padding: 3, marginHorizontal: 16, marginTop: 12 },
  subTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  subTabText: { fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14, alignItems: 'center' },
  voiceBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  voiceBtnIcon: { fontSize: 18 },
  voiceBtnText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  smartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14 },
  smartBtnIcon: { color: '#fff', fontSize: 16 },
  smartBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  addBtnText: { fontSize: 18, fontWeight: '600' },
  voiceHintBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 4 },
  voiceHintText: { fontSize: 13, lineHeight: 20 },
  storeRecBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  storeRecEmoji: { fontSize: 22 },
  storeRecTitle: { fontSize: 14, fontWeight: '600' },
  storeRecSub: { fontSize: 11, marginTop: 2 },
  smartHint: { textAlign: 'center', fontSize: 11, marginTop: 6, marginHorizontal: 16 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemSub: { fontSize: 11, marginTop: 1 },
  itemStore: { fontSize: 11 },
  emptyState: { borderRadius: 20, padding: 36, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  plannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekLabel: { fontSize: 17, fontWeight: '600' },
  generateBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  plannerDayCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  plannerDayLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  plannerMealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  mealTypeEmoji: { fontSize: 14, width: 20 },
  mealTypeLabel: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize', width: 60 },
  mealName: { fontSize: 13, flex: 1 },
  // Recipes
  recipeHero: { margin: 16, borderRadius: 16, padding: 20, marginBottom: 0 },
  recipeHeroTitle: { fontSize: 20, fontWeight: '700' },
  recipeHeroSub: { fontSize: 13, marginTop: 4, marginBottom: 14 },
  generateRecipeBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  generateRecipeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  ideaScroll: { marginTop: 12, marginBottom: 0 },
  ideaChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  ideaChipText: { fontSize: 12, fontWeight: '500' },
  recipeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, gap: 10 },
  recipeTitle: { fontSize: 15, fontWeight: '600' },
  recipeDesc: { fontSize: 12, marginTop: 2 },
  recipeMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  recipeMetaText: { fontSize: 11 },
  // Recipe view
  recipeViewSafe: { flex: 1 },
  recipeViewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  recipeViewBack: { fontSize: 16, fontWeight: '600' },
  recipeViewContent: { paddingHorizontal: 20, paddingTop: 20 },
  recipeViewTitle: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  recipeViewDesc: { fontSize: 15, lineHeight: 23, marginBottom: 16 },
  recipeStats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  recipeStat: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  recipeStatLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  recipeStatVal: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  recipeSection: { fontSize: 17, fontWeight: '700', marginBottom: 10, marginTop: 6 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 7 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  ingredientText: { fontSize: 15, lineHeight: 22, flex: 1 },
  recipeInstructions: { fontSize: 15, lineHeight: 26 },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 14, lineHeight: 20 },
  smartInput: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
});
