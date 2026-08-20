import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export function AppLogo({ className = 'w-8 h-8 rounded-xl', iconSize = 18 }) {
  const [logoSrc, setLogoSrc] = useState('/logo.png');
  const [imgError, setImgError] = useState(false);

  const handleError = () => {
    if (logoSrc === '/logo.png') {
      setLogoSrc('/logo.svg');
    } else {
      setImgError(true);
    }
  };

  if (!imgError) {
    return (
      <img
        src={logoSrc}
        alt="Logo"
        onError={handleError}
        className={`${className} object-cover shrink-0 overflow-hidden`}
      />
    );
  }

  return (
    <div className={`${className} bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0`}>
      <Sparkles size={iconSize} />
    </div>
  );
}
