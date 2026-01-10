import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TemplateCard as TemplateCardType } from '../../data/templates';

interface TemplateCardProps {
  template: TemplateCardType;
  isSelected: boolean;
  onSelect: () => void;
}

export function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={1}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{template.name}</Text>
        {isSelected && <View style={styles.checkmark} />}
      </View>
      
      <Text style={styles.description}>{template.description}</Text>
      
      <View style={styles.tagsContainer}>
        {template.tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.idealDays}>
        Best for {template.idealDays.join(', ')} days/week
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  cardSelected: {
    borderColor: '#FD6B00',
    backgroundColor: '#FFF5F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FD6B00',
    borderWidth: 2,
    borderColor: '#FD6B00',
  },
  description: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#E3E6E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#817B77',
    fontWeight: '500',
  },
  idealDays: {
    fontSize: 12,
    color: '#817B77',
    fontStyle: 'italic',
  },
});

