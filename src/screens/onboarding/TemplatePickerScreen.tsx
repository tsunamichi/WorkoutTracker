import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { ProgressHeader } from '../../components/common/ProgressHeader';
import { StickyFooter } from '../../components/common/StickyFooter';
import { TemplateCard } from '../../components/templates/TemplateCard';
import { getTemplates } from '../../data/templates';
import { CycleTemplateId } from '../../types/workout';

type OnboardingStackParamList = {
  TemplatePicker: undefined;
  TemplateEditor: undefined;
  CustomTemplateInput: undefined;
};

type TemplatePickerScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'TemplatePicker'>;
};

export function TemplatePickerScreen({ navigation }: TemplatePickerScreenProps) {
  const { startDraftFromTemplate, startDraftFromCustomText } = useOnboardingStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<CycleTemplateId | null>(null);

  const templates = getTemplates();

  const handleContinue = () => {
    if (!selectedTemplateId) return;

    if (selectedTemplateId === 'custom') {
      startDraftFromCustomText();
      navigation.navigate('CustomTemplateInput');
    } else {
      startDraftFromTemplate(selectedTemplateId);
      navigation.navigate('TemplateEditor');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ProgressHeader
          stepLabel="Step 2 of 4"
          title="Choose a template"
        />

        <View style={styles.templateList}>
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={() => setSelectedTemplateId(template.id)}
            />
          ))}
        </View>
      </ScrollView>

      <StickyFooter
        buttonText="Continue"
        onPress={handleContinue}
        disabled={!selectedTemplateId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  templateList: {
    paddingTop: 8,
  },
});

