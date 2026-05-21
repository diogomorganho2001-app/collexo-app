import React, { useEffect, useState } from 'react';

/**
 * Renders a stack of milestone toast messages.
 * Props: messages – string[]
 *        onDone   – called when all toasts have vanished
 */
export default function MilestoneToast({ messages, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!messages.length) return;
    const t1 = setTimeout(() => setVisible(false), 3000);
    const t2 = setTimeout(() => { onDone?.(); }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages]);

  if (!messages.length || !visible) return null;

  return (
    <>
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`milestone-toast${!visible ? ' out' : ''}`}
          style={{ bottom: `${100 + i * 70}px` }}
        >
          {msg}
        </div>
      ))}
    </>
  );
}
