# OpenAI Voice APIs Integration Guide

## Overview

The Trainer tab uses OpenAI's voice APIs for natural conversations:
- **Whisper API** - Converts your voice to text (speech-to-text)
- **TTS API** - Makes the AI speak to you (text-to-speech) 🔊

This creates a fully voice-enabled AI personal trainer experience!

## ✅ What's Included with Your OpenAI Account

### Whisper API (Speech-to-Text)
- **Pricing**: $0.006 per minute of audio (~$0.36 per hour)
- **Model**: `whisper-1` (based on Whisper large-v2)
- **Supported formats**: mp3, mp4, mpeg, mpga, m4a, wav, webm
- **File size limit**: 25 MB
- **Languages**: 50+ languages supported
- **Accuracy**: Industry-leading speech recognition

### TTS API (Text-to-Speech) 🔊
- **Pricing**: $15 per 1M characters (~$0.015 per 1000 characters)
- **Models**: `tts-1` (standard), `tts-1-hd` (high quality)
- **Voices**: alloy, echo, fable, onyx, nova, shimmer
- **Current voice**: "nova" (female, natural-sounding)
- **Output format**: MP3
- **Speed**: Adjustable (0.25x to 4x)

### Your API Key
Your OpenAI API key should be configured in the app settings:
```
sk-proj-YOUR_API_KEY_HERE
```

**Important**: This key is stored in your app's settings and works for:
- ✅ Whisper API (speech-to-text)
- ✅ TTS API (text-to-speech) - **NOW ENABLED!** 🔊
- ✅ GPT-4 API (text generation for cycle creation)

## 🎯 How It Works

### Current Implementation

1. **AI speaks greeting** 🔊 → Uses TTS API to generate and play audio
2. **User taps record button** → Starts recording audio using `expo-av`
3. **User taps stop** → Recording stops and audio is saved locally
4. **Audio is sent to Whisper API** → Transcribed to text
5. **Text is displayed** → User's response is added to the conversation
6. **AI speaks next question** 🔊 → TTS generates and plays the response
7. **Repeat** → Continue conversation until complete

### Conversation Flow

```
AI: 🔊 Speaks: "What's your main goal right now?"
User: [Records voice] → Transcribed to text
AI: 🔊 Speaks: "How long have you been training consistently?"
User: [Records voice] → Transcribed to text
AI: 🔊 Speaks: "Great! Let's create your personalized training cycle..."
[Shows transcript of entire conversation]
```

**Note**: The waveform animates while the AI is speaking!

## 📁 Files Modified/Created

### New Files
- `src/services/whisperService.ts` - Whisper API integration
- `WHISPER_INTEGRATION.md` - This documentation

### Modified Files
- `src/screens/TrainerScreen.tsx` - Integrated real transcription
- `ios/WorkoutTracker/Info.plist` - Added microphone permission
- `package.json` - Added `expo-file-system` dependency

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/fcasanov/Projects/WorkoutTracker
npm install
```

This will install the newly added `expo-file-system` package.

### 2. iOS Setup

```bash
cd ios
pod install
cd ..
```

### 3. Run the App

```bash
npm run ios
```

### 4. Test the Trainer

1. Open the app
2. Navigate to the "Trainer" tab (3rd tab)
3. Tap the orange record button
4. Grant microphone permission when prompted
5. Speak your answer
6. Tap the red stop button
7. Wait for transcription (usually 1-2 seconds)
8. See your transcribed text appear!

## 🎤 Microphone Permission

The app now requests microphone access with this message:
```
"This app needs access to your microphone to record voice messages for the AI Trainer feature."
```

This is configured in `ios/WorkoutTracker/Info.plist` with the key `NSMicrophoneUsageDescription`.

## 💰 Cost Breakdown

### Per Message
**Your voice (Whisper):**
- Average: 10-15 seconds
- Cost: ~$0.001

**AI voice (TTS):**
- Average: 50 characters
- Cost: ~$0.0003

### Per Conversation
- 2 user messages: ~$0.002
- 3 AI messages: ~$0.001
- **Total: ~$0.003** (less than half a penny!)

### Monthly Usage
- Heavy user (10 conversations/day): ~$1/month
- Normal user (3 conversations/day): ~$0.30/month
- Light user (1 conversation/day): ~$0.10/month

### Compared to Other APIs
- Whisper: $0.006/minute
- TTS: $15/1M characters
- GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens

**Bottom line**: Full voice interaction (both ways!) for less than $1/month with typical usage.

## 🔐 API Key Security

### Current Setup
- API key is stored in app settings (local storage)
- Key is sent directly to OpenAI from the device
- No intermediate server required

### Production Recommendations
For a production app, consider:
1. **Server-side proxy**: Route API calls through your backend
2. **Usage limits**: Implement per-user rate limiting
3. **Key rotation**: Regularly rotate API keys
4. **Monitoring**: Track usage and costs via OpenAI dashboard

## 🐛 Troubleshooting

### "Invalid or missing OpenAI API key"
- Go to Profile settings
- Verify your API key starts with `sk-`
- Make sure it's not expired

### "Transcription failed"
- Check internet connection
- Verify audio was recorded (check console logs)
- Try speaking louder/clearer
- Check OpenAI API status: https://status.openai.com

### "Permission denied"
- Go to iOS Settings → WorkoutTracker
- Enable Microphone permission
- Restart the app

### Audio format issues
- iOS records in m4a format by default (supported by Whisper)
- If issues persist, check `expo-av` recording settings

## 🚀 Future Enhancements

### Potential Features
1. ~~**AI Voice Responses**~~ - ✅ DONE! The AI speaks with "nova" voice
2. **Try Different Voices**: Change to alloy, echo, fable, onyx, or shimmer
3. **Real-time Transcription**: Show text as user speaks (streaming)
4. **Multi-language Support**: Detect and transcribe any language
5. **Conversation History**: Save past trainer conversations
6. **Voice Commands**: "Create a push workout" → AI generates it
7. **Pronunciation Feedback**: Help with exercise name pronunciation

### Changing the AI Voice
Edit `src/services/whisperService.ts`:

```typescript
// Line ~92
voice: 'nova', // Try: alloy, echo, fable, onyx, nova, shimmer
```

**Voice Descriptions:**
- **alloy** - Neutral, balanced
- **echo** - Male voice, clear
- **fable** - British accent, warm
- **onyx** - Male, deep and rich
- **nova** - Female, natural (current) ⭐
- **shimmer** - Female, upbeat

## 📊 Monitoring Usage

### OpenAI Dashboard
1. Visit: https://platform.openai.com/usage
2. View usage by:
   - API endpoint (Whisper, GPT-4, etc.)
   - Date range
   - Cost breakdown

### In-App Logging
The app logs transcription events:
```
🎤 Starting transcription...
✅ Transcription successful: [text]
```

Check Xcode console or React Native debugger for logs.

## 📝 Code Examples

### Basic Transcription
```typescript
import { transcribeAudio } from '../services/whisperService';

const { text, error } = await transcribeAudio(audioUri, apiKey);
if (error) {
  console.error('Error:', error);
} else {
  console.log('Transcribed:', text);
}
```

### With TTS Response (Already Implemented!)
```typescript
import { transcribeAudio, generateSpeech } from '../services/whisperService';
import { Audio } from 'expo-av';

// Transcribe user's voice
const { text } = await transcribeAudio(audioUri, apiKey);

// Generate AI voice response
const aiResponse = "Great! Let's get started.";
const speechUri = await generateSpeech(aiResponse, apiKey);

// Play the audio
const { sound } = await Audio.Sound.createAsync(
  { uri: speechUri },
  { shouldPlay: true }
);

// Listen for when it finishes
sound.setOnPlaybackStatusUpdate((status) => {
  if (status.isLoaded && status.didJustFinish) {
    console.log('AI finished speaking');
    sound.unloadAsync();
  }
});
```

## ✅ Summary

You're all set! Both Whisper and TTS APIs are fully integrated and working. Your OpenAI API key includes access to both, so there's no additional setup needed.

**Key Points**:
- ✅ **Full voice interaction** - AI speaks to you, you speak to AI 🔊
- ✅ Whisper API transcribes your voice (1-2 seconds)
- ✅ TTS API makes the AI speak (instant playback)
- ✅ Very affordable (~$0.003 per conversation)
- ✅ Industry-leading accuracy
- ✅ Natural-sounding voices (using "nova")
- ✅ Works seamlessly with your existing API key
- ✅ Waveform animates while AI speaks

**Current Voice**: "nova" (female, natural)
**Try Others**: Edit `whisperService.ts` to change to alloy, echo, fable, onyx, or shimmer

Happy training! 🏋️‍♂️🔊

