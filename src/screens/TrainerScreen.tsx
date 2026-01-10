import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants';
import { useStore } from '../store';
import { transcribeAudio, generateSpeech } from '../services/whisperService';
import Svg, { Path } from 'react-native-svg';

interface Message {
  type: 'ai' | 'user';
  text: string;
}

type ConversationStep = 'greeting' | 'goal' | 'experience' | 'complete';

const QUESTIONS = {
  greeting: "What's your main goal right now?",
  experience: "How long have you been training consistently?",
};

export function TrainerScreen() {
  const { settings } = useStore();
  const [step, setStep] = useState<ConversationStep>('greeting');
  const [messages, setMessages] = useState<Message[]>([
    { type: 'ai', text: QUESTIONS.greeting },
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

  // Animation values
  const waveAnimation1 = useRef(new Animated.Value(0)).current;
  const waveAnimation2 = useRef(new Animated.Value(0)).current;
  const waveAnimation3 = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const recordButtonScale = useRef(new Animated.Value(1)).current;

  // Request audio permissions and play initial greeting
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Audio recording permission is required to use the trainer.');
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Play initial greeting
      await speakMessage(QUESTIONS.greeting);
    })();
    
    // Cleanup on unmount
    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, []);

  // Function to make the AI speak
  const speakMessage = async (text: string) => {
    if (!settings.openaiApiKey || !settings.openaiApiKey.startsWith('sk-')) {
      console.log('⚠️ No API key, skipping TTS');
      return;
    }

    try {
      setIsSpeaking(true);
      console.log('🔊 Generating speech for:', text.substring(0, 50) + '...');
      
      const speechUri = await generateSpeech(text, settings.openaiApiKey);
      
      if (!speechUri) {
        console.error('Failed to generate speech');
        setIsSpeaking(false);
        return;
      }

      // Unload previous sound if exists
      if (currentSound) {
        await currentSound.unloadAsync();
      }

      // Play the speech
      console.log('🔊 Loading audio file:', speechUri);
      const { sound } = await Audio.Sound.createAsync(
        { uri: speechUri },
        { 
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );
      
      setCurrentSound(sound);

      // Wait for playback to finish
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            console.log('✅ Audio playback finished');
            setIsSpeaking(false);
            sound.unloadAsync();
          } else if (status.isPlaying) {
            console.log('🔊 Audio is playing...');
          }
        }
      });

      console.log('✅ Playing AI speech');
    } catch (error) {
      console.error('❌ TTS error:', error);
      setIsSpeaking(false);
    }
  };

  // Animate waveforms when AI is "speaking" or listening
  useEffect(() => {
    if (isProcessing || isSpeaking || step === 'greeting' || step === 'goal' || step === 'experience') {
      startWaveAnimation();
    }
    return () => {
      waveAnimation1.stopAnimation();
      waveAnimation2.stopAnimation();
      waveAnimation3.stopAnimation();
    };
  }, [isProcessing, isSpeaking, step]);

  const startWaveAnimation = () => {
    const createWaveAnimation = (animValue: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      createWaveAnimation(waveAnimation1, 1500),
      createWaveAnimation(waveAnimation2, 1800),
      createWaveAnimation(waveAnimation3, 2100),
    ]).start();
  };

  const startRecording = async () => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);

      // Animate record button
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordButtonScale, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordButtonScale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      recordButtonScale.setValue(1);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Error', 'Failed to get recording URI');
        return;
      }

      // Check if API key is available
      if (!settings.openaiApiKey || !settings.openaiApiKey.startsWith('sk-')) {
        Alert.alert(
          'API Key Required',
          'Please add your OpenAI API key in the Profile settings to use voice transcription.'
        );
        return;
      }

      // Transcribe audio using Whisper API
      setIsProcessing(true);
      console.log('🎤 Transcribing audio...');
      
      const { text, error } = await transcribeAudio(uri, settings.openaiApiKey);
      
      if (error || !text) {
        console.error('Transcription error:', error);
        Alert.alert('Transcription Error', error || 'Failed to transcribe audio. Please try again.');
        setIsProcessing(false);
        return;
      }

      console.log('✅ Transcription successful:', text);
      
      // Add user's transcribed message
      setMessages(prev => [...prev, { type: 'user', text }]);
      setIsProcessing(false);

      // Move to next step
      if (step === 'greeting') {
        await new Promise(resolve => setTimeout(resolve, 500));
        setMessages(prev => [...prev, { type: 'ai', text: QUESTIONS.experience }]);
        setStep('experience');
        await speakMessage(QUESTIONS.experience);
      } else if (step === 'goal') {
        await new Promise(resolve => setTimeout(resolve, 500));
        setMessages(prev => [...prev, { type: 'ai', text: QUESTIONS.experience }]);
        setStep('experience');
        await speakMessage(QUESTIONS.experience);
      } else if (step === 'experience') {
        await new Promise(resolve => setTimeout(resolve, 500));
        const finalMessage = "Great! Based on your goals and experience, I'll help you create a personalized training cycle. Let's build something amazing together!";
        setMessages(prev => [
          ...prev,
          { 
            type: 'ai', 
            text: finalMessage
          }
        ]);
        await speakMessage(finalMessage);
        setStep('complete');
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to process recording');
      setIsProcessing(false);
    }
  };

  const handleRecordPress = () => {
    // Don't allow recording while AI is speaking
    if (isSpeaking) {
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      if (step === 'greeting') {
        setStep('goal');
      }
      startRecording();
    }
  };

  // Organic wave shapes
  const scale1 = waveAnimation1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });
  const scale2 = waveAnimation2.interpolate({
    inputRange: [0, 1],
    outputRange: [1.2, 0.9],
  });
  const scale3 = waveAnimation3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Trainer</Text>
        <Text style={styles.headerSubtitle}>Let's create your perfect training cycle</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {step === 'complete' ? (
          // Show transcript when conversation is complete
          <ScrollView style={styles.transcriptContainer} contentContainerStyle={styles.transcriptContent}>
            <Text style={styles.transcriptTitle}>Conversation Summary</Text>
            {messages.map((message, index) => (
              <View 
                key={index} 
                style={[
                  styles.messageContainer,
                  message.type === 'ai' ? styles.aiMessage : styles.userMessage
                ]}
              >
                <Text style={styles.messageLabel}>
                  {message.type === 'ai' ? 'Trainer' : 'You'}
                </Text>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          // Show animated waveform
          <View style={styles.waveformContainer}>
            <View style={styles.waveformWrapper}>
              <Animated.View
                style={[
                  styles.wave,
                  styles.wave1,
                  { transform: [{ scale: scale1 }] },
                ]}
              >
                <Svg width="200" height="200" viewBox="0 0 200 200">
                  <Path
                    d="M100,20 C140,20 180,50 180,90 C180,130 150,160 110,170 C70,180 30,160 20,120 C10,80 40,40 80,30 C90,27 95,20 100,20 Z"
                    fill={COLORS.accentPrimary}
                    opacity={0.3}
                  />
                </Svg>
              </Animated.View>
              <Animated.View
                style={[
                  styles.wave,
                  styles.wave2,
                  { transform: [{ scale: scale2 }] },
                ]}
              >
                <Svg width="180" height="180" viewBox="0 0 180 180">
                  <Path
                    d="M90,10 C130,15 165,45 170,85 C175,125 145,155 105,165 C65,175 25,150 15,110 C5,70 35,25 75,15 C82,13 86,10 90,10 Z"
                    fill={COLORS.accentPrimary}
                    opacity={0.4}
                  />
                </Svg>
              </Animated.View>
              <Animated.View
                style={[
                  styles.wave,
                  styles.wave3,
                  { transform: [{ scale: scale3 }] },
                ]}
              >
                <Svg width="160" height="160" viewBox="0 0 160 160">
                  <Path
                    d="M80,15 C115,20 145,50 150,85 C155,120 130,145 95,150 C60,155 25,130 20,95 C15,60 40,30 75,20 C77,19 78,15 80,15 Z"
                    fill={COLORS.accentPrimary}
                    opacity={0.6}
                  />
                </Svg>
              </Animated.View>
            </View>

            {/* Current status text */}
            <View style={styles.statusContainer}>
              {isSpeaking ? (
                <Text style={styles.statusText}>AI is speaking...</Text>
              ) : isProcessing ? (
                <Text style={styles.statusText}>Processing your response...</Text>
              ) : isRecording ? (
                <Text style={styles.statusText}>Listening...</Text>
              ) : (
                <Text style={styles.statusText}>
                  {step === 'greeting' ? 'Listening to trainer...' : 'Tap to answer'}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Record Button */}
      {step !== 'complete' && (
        <View style={styles.recordButtonContainer}>
          <TouchableOpacity
            onPress={handleRecordPress}
            disabled={isProcessing || isSpeaking}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                { transform: [{ scale: recordButtonScale }] },
              ]}
            >
              {isRecording ? (
                <View style={styles.recordButtonStop} />
              ) : (
                <View style={styles.recordButtonIcon} />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: '#000000',
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  waveformWrapper: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  wave: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wave1: {},
  wave2: {},
  wave3: {},
  statusContainer: {
    marginTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  statusText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  recordButtonContainer: {
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: COLORS.error,
  },
  recordButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  recordButtonStop: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  transcriptContainer: {
    flex: 1,
    width: '100%',
  },
  transcriptContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  transcriptTitle: {
    ...TYPOGRAPHY.h2,
    color: '#000000',
    marginBottom: SPACING.xl,
  },
  messageContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  aiMessage: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userMessage: {
    backgroundColor: COLORS.accentPrimary,
    opacity: 0.9,
  },
  messageLabel: {
    ...TYPOGRAPHY.metaBold,
    marginBottom: SPACING.xs,
    color: '#000000',
  },
  messageText: {
    ...TYPOGRAPHY.body,
    color: '#000000',
    lineHeight: 22,
  },
});

