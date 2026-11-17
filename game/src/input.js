// Keyboard + mouse state. The wisp steers toward the pointer (mouse) or with
// WASD / arrow keys; Space dashes, P pauses, M mutes, R restarts, Enter starts.
export function createInput(canvas) {
  const input = {
    pointer: { x: 480, y: 300, inside: false, down: false },
    keys: new Set(),
    // Edge-triggered presses, consumed once by the game loop.
    pressed: new Set(),
  };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 800,
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const p = canvasPoint(event);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    input.pointer.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = canvasPoint(event);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    input.pointer.inside = true;
    input.pointer.down = true;
    input.pressed.add('pointer');
  });
  canvas.addEventListener('pointerup', () => {
    input.pointer.down = false;
  });
  canvas.addEventListener('pointerleave', () => {
    input.pointer.inside = false;
  });

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pointer.down = false;
  });

  input.consume = (code) => {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
    return false;
  };
  input.endFrame = () => {
    input.pressed.clear();
  };

  // Combined steering vector from keys alone (-1..1 on each axis).
  input.keyVector = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
    if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
    if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
    if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  };

  return input;
}
