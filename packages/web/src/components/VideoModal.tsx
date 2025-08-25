import { useState } from 'react';
import { X, Play } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoModal({ isOpen, onClose }: VideoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="relative bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="aspect-video bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-green-600 rounded-full p-6 mb-4 inline-flex">
              <Play className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Demo Video</h3>
            <p className="text-gray-400">
              See GraphDone in action - coming soon!
            </p>
          </div>
        </div>
        
        <div className="p-6">
          <h4 className="text-lg font-semibold text-white mb-2">
            What you'll see in the demo:
          </h4>
          <ul className="text-gray-300 space-y-2">
            <li>• Creating your first graph with connected tasks</li>
            <li>• How democratic prioritization works in real-time</li>
            <li>• AI agents joining and contributing to your project</li>
            <li>• The spherical visualization showing true project priority</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DemoButton() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <>
      <button 
        onClick={() => setShowVideo(true)}
        className="border border-gray-600 hover:border-gray-500 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all flex items-center"
      >
        <Play className="mr-2 h-5 w-5" />
        Watch Demo
      </button>
      
      <VideoModal 
        isOpen={showVideo} 
        onClose={() => setShowVideo(false)} 
      />
    </>
  );
}