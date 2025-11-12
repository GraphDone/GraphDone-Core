import { useState, useEffect, useRef } from 'react';
import { Shield, Volume2, CheckCircle, KeyRound } from 'lucide-react';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface CodeCaptchaProps {
  onVerified: (code: string) => void;
  onError?: (error: string) => void;
  className?: string;
  difficulty?: DifficultyLevel;
}

export function CodeCaptcha({
  onVerified,
  onError,
  className = '',
  difficulty = 'easy'
}: CodeCaptchaProps) {
  const [code, setCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const codeLength = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;

  const generateCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O
    const numbers = '23456789'; // Exclude 0, 1
    const specials = '@#$%&*+=?'; // Common special characters

    const codeArray: string[] = [];

    if (difficulty === 'easy') {
      // Easy: 4 characters, letters and numbers only
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
    } else if (difficulty === 'medium') {
      // Medium: 5 characters, letters and numbers only
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
    } else {
      // Hard: 6 characters with special chars
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(letters.charAt(Math.floor(Math.random() * letters.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
      codeArray.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
      codeArray.push(specials.charAt(Math.floor(Math.random() * specials.length)));
      codeArray.push(specials.charAt(Math.floor(Math.random() * specials.length)));
    }

    // Shuffle the array using Fisher-Yates algorithm
    for (let i = codeArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [codeArray[i], codeArray[j]] = [codeArray[j], codeArray[i]];
    }

    const newCode = codeArray.join('');
    setCode(newCode);
    setUserInput('');
    setError('');
    setIsVerified(false);
  };

  // Draw distorted code on canvas with dot-matrix effect
  const drawCodeImage = (codeText: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 120;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background with gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(17, 24, 39, 0.95)');
    gradient.addColorStop(1, 'rgba(31, 41, 55, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add colorful dotted background pattern
    const colors = [
      'rgba(20, 184, 166, 0.5)',   // teal
      'rgba(6, 182, 212, 0.5)',    // cyan
      'rgba(59, 130, 246, 0.5)',   // blue
      'rgba(139, 92, 246, 0.5)',   // purple
      'rgba(236, 72, 153, 0.5)',   // pink
      'rgba(249, 115, 22, 0.5)',   // orange
      'rgba(234, 179, 8, 0.5)',    // yellow
      'rgba(34, 197, 94, 0.5)',    // green
    ];

    const dotSpacing = 6;
    for (let x = 0; x < canvas.width; x += dotSpacing) {
      for (let y = 0; y < canvas.height; y += dotSpacing) {
        if (Math.random() > 0.6) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw colorful distorted lines with dots
    for (let i = 0; i < 15; i++) {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      const endX = Math.random() * canvas.width;
      const endY = Math.random() * canvas.height;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const steps = 40;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 5;
        const y = startY + (endY - startY) * t + (Math.random() - 0.5) * 5;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Add random colored circles for more distraction
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 15 + 5;
      const color = colors[Math.floor(Math.random() * colors.length)];

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw each character with dot-matrix effect
    ctx.font = 'bold 52px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const charSpacing = canvas.width / (codeText.length + 1);

    codeText.split('').forEach((char, index) => {
      const baseX = charSpacing * (index + 1);
      const baseY = canvas.height / 2;

      // Create temporary canvas to get character pixels
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCanvas.width = 60;
      tempCanvas.height = 70;

      tempCtx.font = 'bold 52px monospace';
      tempCtx.textBaseline = 'middle';
      tempCtx.textAlign = 'center';
      tempCtx.fillStyle = 'white';
      tempCtx.fillText(char, 30, 35);

      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const pixels = imageData.data;

      // Draw character as dots with distortion
      const dotSize = 2.5;
      const dotSpacing = 4;

      for (let y = 0; y < tempCanvas.height; y += dotSpacing) {
        for (let x = 0; x < tempCanvas.width; x += dotSpacing) {
          const i = (y * tempCanvas.width + x) * 4;
          const alpha = pixels[i + 3];

          if (alpha > 100) {
            // Add random distortion to dot position
            const distortX = (Math.random() - 0.5) * 2;
            const distortY = (Math.random() - 0.5) * 2;
            const rotation = (Math.random() - 0.5) * 0.15;

            const offsetX = x - 30;
            const offsetY = y - 35;

            const rotatedX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
            const rotatedY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);

            const finalX = baseX + rotatedX + distortX;
            const finalY = baseY + rotatedY + distortY;

            // Draw dot with gradient effect
            const gradient = ctx.createRadialGradient(finalX, finalY, 0, finalX, finalY, dotSize);
            gradient.addColorStop(0, '#14b8a6');
            gradient.addColorStop(0.5, '#06b6d4');
            gradient.addColorStop(1, 'rgba(20, 184, 166, 0.3)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(finalX, finalY, dotSize, 0, Math.PI * 2);
            ctx.fill();

            // Add glow effect randomly
            if (Math.random() > 0.8) {
              ctx.fillStyle = 'rgba(20, 184, 166, 0.15)';
              ctx.beginPath();
              ctx.arc(finalX, finalY, dotSize * 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    });

    // Add more colorful noise dots on top
    for (let i = 0; i < 400; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Add random short lines for additional distraction
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const length = Math.random() * 20 + 5;
      const angle = Math.random() * Math.PI * 2;
      const color = colors[Math.floor(Math.random() * colors.length)];

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
  };

  useEffect(() => {
    generateCode();
  }, []);

  useEffect(() => {
    if (code) {
      drawCodeImage(code);
    }
  }, [code]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    console.log('🔐 Verifying CAPTCHA code:', { userInput, code, match: userInput.toUpperCase() === code });
    setIsVerifying(true);
    setError('');

    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (userInput.toUpperCase() === code) {
      console.log('✅ CAPTCHA verified successfully!');
      setIsVerified(true);
      onVerified(code);
      setIsVerifying(false);
    } else {
      const errorMsg = 'Incorrect code. Please try again.';
      console.log('❌ CAPTCHA verification failed:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
      setIsVerifying(false);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      // Delay before generating new code so user can see error message
      setTimeout(() => {
        generateCode();
      }, 3000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput.length === codeLength) {
      handleVerify();
    }
  };

  const speakCode = () => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Create speech utterance
      const utterance = new SpeechSynthesisUtterance();

      // Map special characters to spoken words
      const charToSpeech: Record<string, string> = {
        '@': 'at sign',
        '#': 'hash',
        '$': 'dollar',
        '%': 'percent',
        '&': 'and',
        '*': 'star',
        '+': 'plus',
        '=': 'equals',
        '?': 'question mark'
      };

      // Convert code to spoken format
      const spokenCode = code.split('').map(char => {
        if (charToSpeech[char]) {
          return charToSpeech[char];
        }
        return char;
      }).join('. ');

      utterance.text = `Verification code: ${spokenCode}. I repeat: ${spokenCode}`;
      utterance.rate = 0.75; // Slower speech for clarity
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className={className}>
      <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/50 backdrop-blur-sm border-2 border-teal-500/30 rounded-xl p-5 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-400" />
            <h3 className="text-sm font-semibold text-teal-300">Verification required!</h3>
          </div>
          <p className="text-xs text-gray-400">
            Protected by <span className="text-teal-400 font-semibold">ALTCHA</span>
          </p>
        </div>

        {/* Code Display */}
        <div className="mb-4">
          <div className="bg-gray-900/60 border border-teal-500/40 rounded-lg p-4 relative overflow-hidden">
            <div className="relative flex items-center justify-between">
              {/* Canvas Code Image */}
              <div className="flex-1 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto rounded-lg"
                  style={{ maxWidth: '400px', display: 'block' }}
                />
              </div>

              {/* Controls Column - Right Side */}
              <div className="flex flex-col gap-2 ml-3">
                {/* New Code Button */}
                <button
                  type="button"
                  onClick={generateCode}
                  className="p-2 bg-teal-600/20 hover:bg-teal-600/40 border border-teal-500/40 hover:border-teal-400 rounded-lg transition-all duration-200 group"
                  title="Generate new code"
                >
                  <span className="text-xl text-teal-400 group-hover:rotate-180 transition-transform duration-300 block">↻</span>
                </button>

                {/* Listen Button */}
                <button
                  type="button"
                  onClick={speakCode}
                  disabled={isSpeaking}
                  className="p-2 bg-teal-600/20 hover:bg-teal-600/40 border border-teal-500/40 hover:border-teal-400 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Listen to code"
                >
                  <Volume2 className={`h-5 w-5 text-teal-400 transition-transform ${isSpeaking ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Input Field and Verify Button Row */}
        <div className="mb-3">
          <div className="flex gap-3">
            {/* Input Field */}
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={inputRef}
                id="captcha-input"
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.toUpperCase().slice(0, codeLength))}
                onKeyPress={handleKeyPress}
                onPaste={(e) => e.preventDefault()}
                maxLength={codeLength}
                className={`w-full pl-12 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-500/50 focus:ring-red-500/50'
                    : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                } ${shouldShake ? 'animate-shake' : ''}`}
                placeholder="Enter Code"
                disabled={isVerifying}
              />
            </div>

            {/* Verify Button */}
            <button
              type="button"
              onClick={handleVerify}
              disabled={userInput.length !== codeLength || isVerifying}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-teal-500/20"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}
          {isVerified && (
            <div className="mt-2 p-3 bg-teal-900/30 border border-teal-500/50 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-400" />
              <p className="text-sm text-teal-300 font-medium">
                Verified successfully!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
