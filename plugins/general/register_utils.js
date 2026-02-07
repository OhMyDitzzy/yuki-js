import pkg from "canvafy";
const { Captcha: CanvafyCaptcha } = pkg

function AutoCleanup(delayMs = 60000) {
  return function(target, propertyKey, descriptor) {
    const original = descriptor.value;

    descriptor.value = async function(...args) {
      const result = await original.apply(this, args);

      setTimeout(() => {
        this.cleanup();
      }, delayMs);

      return result;
    };

    return descriptor;
  };
}

function Cached() {
  return function(target, propertyKey, descriptor) {
    const original = descriptor.value;

    descriptor.value = async function(...args) {
      if (this.buffer) {
        return this.buffer;
      }

      return await original.apply(this, args);
    };

    return descriptor;
  };
}

export class Captcha {
  constructor(length = 6) {
    this.value = this.generateCode(length);
    this.buffer = null;
  }

  generateCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async build(options = {}) {
    const captcha = await new CanvafyCaptcha()
      .setCaptchaKey(this.value)
      .setBorder(options.border || "#ffffff")
      .setOverlayOpacity(options.opacity || 0.7)
      .build();

    this.buffer = captcha;
    return captcha;
  }

  verify(input) {
    return this.value.toUpperCase() === input.toUpperCase();
  }

  getBuffer() {
    return this.buffer;
  }

  cleanup() {
    this.buffer = null;
  }
}

const buildDescriptor = Object.getOwnPropertyDescriptor(Captcha.prototype, 'build');
Object.defineProperty(
  Captcha.prototype,
  'build',
  AutoCleanup(60000)(Captcha.prototype, 'build', 
    Cached()(Captcha.prototype, 'build', buildDescriptor)
  )
);