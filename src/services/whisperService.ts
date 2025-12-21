import OpenAI from 'openai';
import * as FileSystem from 'expo-file-system';

interface TranscriptionResult {
  text: string;
  error?: string;
}

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param audioUri - Local file URI of the audio recording
 * @param apiKey - OpenAI API key
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioUri: string,
  apiKey: string
): Promise<TranscriptionResult> {
  try {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return { text: '', error: 'Invalid or missing OpenAI API key' };
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Required for React Native
    });

    console.log('🎤 Starting transcription...');
    console.log('   Audio URI:', audioUri);

    // Read the audio file as base64
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: 'base64',
    });

    // Convert base64 to blob-like object for the API
    const audioData = {
      uri: audioUri,
      type: 'audio/m4a', // iOS records in m4a format by default
      name: 'recording.m4a',
    };

    // Create form data
    const formData = new FormData();
    formData.append('file', audioData as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Optional: specify language for better accuracy
    formData.append('response_format', 'json');

    // Make direct API call (OpenAI SDK doesn't fully support React Native FormData)
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Whisper API Error:', errorData);
      return { 
        text: '', 
        error: errorData.error?.message || 'Transcription failed' 
      };
    }

    const result = await response.json();
    console.log('✅ Transcription successful');
    console.log('   Text:', result.text);

    return { text: result.text };
  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    return { 
      text: '', 
      error: error.message || 'Failed to transcribe audio' 
    };
  }
}

/**
 * Generate speech from text using OpenAI's TTS API
 * @param text - Text to convert to speech
 * @param apiKey - OpenAI API key
 * @returns URI of the generated audio file
 */
export async function generateSpeech(
  text: string,
  apiKey: string
): Promise<string | null> {
  try {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      console.error('Invalid or missing OpenAI API key');
      return null;
    }

    console.log('🔊 Generating speech...');

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ TTS API Error:', errorText);
      return null;
    }

    // Get the audio as base64
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = arrayBufferToBase64(arrayBuffer);
    
    // Save to local file
    const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
      encoding: 'base64',
    });
    
    console.log('✅ Speech generated:', fileUri);
    return fileUri;
  } catch (error: any) {
    console.error('❌ TTS error:', error);
    return null;
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

