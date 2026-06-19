/**
 * Spam email filter utility for detecting disposable/temporary email addresses.
 *
 * This helps prevent signups from throwaway email services that are commonly
 * used for abuse, spam, or avoiding accountability.
 */

/**
 * List of known disposable/temporary email domains.
 * Updated with popular services as of 2025-2026.
 *
 * NOTE: Legitimate providers like protonmail.com are intentionally excluded.
 * Add new domains only when verified as disposable/temporary services.
 */
const DISPOSABLE_DOMAINS = [
  // Classic short-lived
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '20minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me',

  // Popular temporary
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'temp-mail.io',
  'temp-mail.org',
  'tempmailaddress.com',
  'temporarymail.com',
  'throwawaymail.com',
  'throwaway.email',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'maildrop.cc',
  'yopmail.com',
  'yopmail.net',
  'yopmail.org',
  'yopmail.fr',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'fakemailgenerator.com',
  'fakeinbox.com',
  'fakeinbox.net',
  'dispostable.com',
  'emailondeck.com',
  'emailfake.com',
  'emailfake.net',
  'mail-temp.com',
  'mailtemp.net',
  'mailtemp.org',
  'mailtemp.co',
  'mailtemp.cc',
  'mailtemp.info',
  'mailtemp.biz',
  'mailtemp.us',
  'mailtemp.co.uk',
  'mailtemp.de',
  'mailtemp.fr',
  'mailtemp.es',
  'mailtemp.it',

  // More recent / popular 2025-2026
  'maildrop.cc',
  'maildrop.co',
  'maildrop.info',
  'maildrop.biz',
  'maildrop.us',
  'maildrop.io',
  'maildrop.app',
  'maildrop.dev',
  'maildrop.org',
  'maildrop.net',
  'maildrop.co.uk',
  'maildrop.de',
  'maildrop.fr',
  'maildrop.es',
  'maildrop.it',
  'maildrop.ru',
  'maildrop.cn',
  'maildrop.jp',

  'inbox.lv',
  'inbox.ru',
  'inbox.com',
  'inbox.eu',
  'inbox.co',
  'inbox.org',
  'inbox.net',
  'inbox.info',
  'inbox.biz',
  'inbox.us',
  'inbox.io',

  // NOTE: Do not add legitimate providers like protonmail.com, gmail.com, etc.
];

/**
 * Set for O(1) lookups when checking disposable domains.
 */
const DISPOSABLE_DOMAIN_SET = new Set(DISPOSABLE_DOMAINS);

/**
 * Extracts the domain from an email address.
 *
 * @param email - Email address to parse
 * @returns The domain part (lowercase) or empty string if invalid
 */
function extractDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(atIndex + 1);
}

/**
 * Checks if an email address belongs to a known disposable/temporary email service.
 *
 * @param email - Email address to check
 * @returns true if the email domain is in the disposable list
 *
 * @example
 * ```ts
 * isDisposableEmail('test@10minutemail.com'); // true
 * isDisposableEmail('user@gmail.com'); // false
 * isDisposableEmail('invalid-email'); // false
 * ```
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) {
    return false;
  }
  return DISPOSABLE_DOMAIN_SET.has(domain);
}

/**
 * Validates an email address and checks if it's from a disposable domain.
 *
 * @param email - Email address to validate
 * @returns Object with validation result and disposable status
 *
 * @example
 * ```ts
 * validateEmail('test@10minutemail.com');
 * // { isValid: true, isDisposable: true, domain: '10minutemail.com' }
 *
 * validateEmail('user@gmail.com');
 * // { isValid: true, isDisposable: false, domain: 'gmail.com' }
 * ```
 */
export function validateEmail(email: string): {
  isValid: boolean;
  isDisposable: boolean;
  domain: string;
} {
  const domain = extractDomain(email);
  const isValid = domain.length > 0 && email.includes('@');
  const isDisposable = isValid ? DISPOSABLE_DOMAIN_SET.has(domain) : false;

  return {
    isValid,
    isDisposable,
    domain,
  };
}

/**
 * Filters out disposable email addresses from a list.
 *
 * @param emails - Array of email addresses to filter
 * @returns Array of emails that are NOT from disposable domains
 *
 * @example
 * ```ts
 * filterDisposableEmails([
 *   'user@gmail.com',
 *   'test@10minutemail.com',
 *   'valid@company.com'
 * ]);
 * // ['user@gmail.com', 'valid@company.com']
 * ```
 */
export function filterDisposableEmails(emails: string[]): string[] {
  return emails.filter((email) => !isDisposableEmail(email));
}

/**
 * Spam keyword lists for content-based detection in multiple languages.
 * These are common words/phrases used in promotional/spam emails.
 */
const SPAM_KEYWORDS = {
  english: [
    'promotion',
    'offer',
    'discount',
    'free',
    'bonus',
    'prize',
    'winner',
    'congratulations',
    'limited time',
    'act now',
    "don't miss",
    'exclusive deal',
    'special offer',
    'save big',
    'cheap',
    'bargain',
    'clearance',
    'sale',
    'cash back',
    'instant access',
    'no risk',
    'guarantee',
    '100% free',
    'click here',
    'subscribe',
    'unsubscribe',
    'opt-out',
    'viagra',
    'cialis',
    'casino',
    'lottery',
    'million dollars',
    'make money',
    'work from home',
    'get rich',
    'investment opportunity',
    'debt relief',
    'credit card',
    'loan',
    'mortgage',
    'insurance',
    'refinance',
    'weight loss',
    'diet pill',
    'anti-aging',
    'enhancement',
    'adult',
    'xxx',
    'porn',
    'hot singles',
    'meet local',
    'dating',
    'escort',
    'pharmacy',
    'medication',
    'prescription',
    'generic',
    'online pharmacy',
    'no prescription',
    'fast shipping',
    'overnight',
    'secret',
    'hidden',
    'confidential',
    'urgent',
    'immediate',
    'expire',
    'deadline',
    'last chance',
    'final notice',
    'account suspended',
    'verify your account',
    'confirm your identity',
    'security alert',
    'unusual activity',
    'suspicious login',
    'password reset',
    'update payment',
    'billing issue',
    'invoice attached',
    'payment overdue',
    'action required',
    'click to verify',
    'confirm email',
    'verify now',
    'activate account',
    'suspended account',
    'locked account',
    'compromised account',
  ],
  spanish: [
    'promoción',
    'promocion',
    'oferta',
    'descuento',
    'gratis',
    'bono',
    'bonus',
    'premio',
    'ganador',
    'felicitaciones',
    'felicitaciones',
    'tiempo limitado',
    'actua ahora',
    'actúa ahora',
    'no te pierdas',
    'oferta exclusiva',
    'oferta especial',
    'ahorra mucho',
    'barato',
    'barata',
    'rebaja',
    'liquidación',
    'liquidacion',
    'venta',
    'devolución',
    'devolucion',
    'acceso instantáneo',
    'acceso instantaneo',
    'sin riesgo',
    'garantía',
    'garantia',
    '100% gratis',
    'haz clic',
    'hacer clic',
    'suscríbete',
    'suscribete',
    'darse de baja',
    'cancelar suscripción',
    'cancelar suscripcion',
    'viagra',
    'cialis',
    'casino',
    'lotería',
    'loteria',
    'millón de dólares',
    'millon de dolares',
    'ganar dinero',
    'trabajar desde casa',
    'hazte rico',
    'hacete rico',
    'oportunidad de inversión',
    'oportunidad de inversion',
    'alivio de deudas',
    'tarjeta de crédito',
    'tarjeta de credito',
    'préstamo',
    'prestamo',
    'hipoteca',
    'seguro',
    'refinanciar',
    'perder peso',
    'pérdida de peso',
    'perdida de peso',
    'pastilla para dieta',
    'anti-envejecimiento',
    'anti envejecimiento',
    'mejora',
    'adulto',
    'adultos',
    'citas',
    'citar',
    'solteros',
    'conocer locales',
    'citas locales',
    'farmacia',
    'medicamento',
    'receta',
    'genérico',
    'generico',
    'farmacia online',
    'sin receta',
    'envío rápido',
    'envio rapido',
    'durante la noche',
    'secreto',
    'oculto',
    'confidencial',
    'urgente',
    'inmediato',
    'expira',
    'fecha límite',
    'fecha limite',
    'última oportunidad',
    'ultima oportunidad',
    'aviso final',
    'cuenta suspendida',
    'verificar tu cuenta',
    'confirma tu identidad',
    'alerta de seguridad',
    'actividad inusual',
    'inicio de sesión sospechoso',
    'inicio de sesion sospechoso',
    'restablecer contraseña',
    'restablecer contrasena',
    'actualizar pago',
    'problema de facturación',
    'problema de facturacion',
    'factura adjunta',
    'pago vencido',
    'acción requerida',
    'accion requerida',
    'haz clic para verificar',
    'confirma tu correo',
    'verificar ahora',
    'activar cuenta',
    'cuenta suspendida',
    'cuenta bloqueada',
    'cuenta comprometida',
  ],
  portuguese: [
    'promoção',
    'promocao',
    'oferta',
    'desconto',
    'grátis',
    'gratis',
    'bônus',
    'bonus',
    'prêmio',
    'premio',
    'vencedor',
    'parabéns',
    'parabens',
    'tempo limitado',
    'aja agora',
    'não perca',
    'nao perca',
    'oferta exclusiva',
    'oferta especial',
    'economize muito',
    'barato',
    'barata',
    'pechincha',
    'liquidação',
    'liquidacao',
    'venda',
    'reembolso',
    'acesso instantâneo',
    'acesso instantaneo',
    'sem risco',
    'garantia',
    '100% grátis',
    '100% gratis',
    'clique aqui',
    'clicar aqui',
    'inscreva-se',
    'cancele a inscrição',
    'cancele a inscricao',
    'cancelar assinatura',
    'viagra',
    'cialis',
    'cassino',
    'loteria',
    'milhão de dólares',
    'milhao de dolares',
    'ganhar dinheiro',
    'trabalhe de casa',
    'fique rico',
    'oportunidade de investimento',
    'alívio de dívidas',
    'alivio de dividas',
    'cartão de crédito',
    'cartao de credito',
    'empréstimo',
    'emprestimo',
    'hipoteca',
    'seguro',
    'refinanciar',
    'perder peso',
    'perda de peso',
    'pílula de dieta',
    'pilula de dieta',
    'anti-envelhecimento',
    'anti envelhecimento',
    'melhoria',
    'adulto',
    'adultos',
    'encontros',
    'solteiros',
    'conhecer locais',
    'encontros locais',
    'farmácia',
    'farmacia',
    'medicamento',
    'receita',
    'genérico',
    'generico',
    'farmácia online',
    'farmacia online',
    'sem receita',
    'envio rápido',
    'envio rapido',
    'durante a noite',
    'segredo',
    'oculto',
    'confidencial',
    'urgente',
    'imediato',
    'expira',
    'prazo limite',
    'última chance',
    'ultima chance',
    'aviso final',
    'conta suspensa',
    'verificar sua conta',
    'confirme sua identidade',
    'alerta de segurança',
    'alerta de seguranca',
    'atividade incomum',
    'login suspeito',
    'redefinir senha',
    'atualizar pagamento',
    'problema de cobrança',
    'problema de cobranca',
    'fatura anexa',
    'pagamento atrasado',
    'ação necessária',
    'acao necessaria',
    'clique para verificar',
    'confirme seu e-mail',
    'confirme seu email',
    'verificar agora',
    'ativar conta',
    'conta suspensa',
    'conta bloqueada',
    'conta comprometida',
  ],
};

/**
 * Combined set of all spam keywords across all languages for O(1) lookups.
 */
const SPAM_KEYWORD_SET = new Set([
  ...SPAM_KEYWORDS.english,
  ...SPAM_KEYWORDS.spanish,
  ...SPAM_KEYWORDS.portuguese,
]);

/**
 * Normalizes text for spam detection: lowercase and remove common diacritics.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics (á -> a, ñ -> n)
}

/**
 * Checks if text contains spam keywords.
 *
 * @param text - Text to analyze (subject or email body)
 * @param threshold - Minimum number of spam keywords to trigger detection (default: 1)
 * @returns true if spam keywords are found
 *
 * @example
 * ```ts
 * containsSpamKeywords('Get your free bonus now!', 1); // true
 * containsSpamKeywords('Hello, how are you?', 1); // false
 * containsSpamKeywords('Oferta especial de descuento', 1); // true
 * ```
 */
export function containsSpamKeywords(
  text: string,
  threshold: number = 1,
): boolean {
  if (!text || text.length === 0) {
    return false;
  }

  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  let spamCount = 0;

  for (const word of words) {
    if (SPAM_KEYWORD_SET.has(word)) {
      spamCount++;
      if (spamCount >= threshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Comprehensive spam check combining domain and content analysis.
 *
 * @param email - Email address to check
 * @param subject - Email subject (optional)
 * @param body - Email body (optional)
 * @param contentThreshold - Minimum spam keywords in content to trigger (default: 1)
 * @returns Object with detailed spam analysis
 *
 * @example
 * ```ts
 * checkSpam('test@10minutemail.com', 'Free bonus offer');
 * // {
 * //   isSpam: true,
 * //   reasons: ['disposable_domain'],
 * //   domain: '10minutemail.com',
 * //   isDisposable: true,
 * //   hasSpamContent: false
 * // }
 *
 * checkSpam('user@gmail.com', 'Oferta especial de descuento');
 * // {
 * //   isSpam: true,
 * //   reasons: ['spam_content'],
 * //   domain: 'gmail.com',
 * //   isDisposable: false,
 * //   hasSpamContent: true
 * // }
 * ```
 */
export function checkSpam(
  email: string,
  subject?: string,
  body?: string,
  contentThreshold: number = 1,
): {
  isSpam: boolean;
  reasons: ('disposable_domain' | 'spam_content')[];
  domain: string;
  isDisposable: boolean;
  hasSpamContent: boolean;
} {
  const domain = extractDomain(email);
  const isDisposable = DISPOSABLE_DOMAIN_SET.has(domain);

  const reasons: ('disposable_domain' | 'spam_content')[] = [];
  if (isDisposable) {
    reasons.push('disposable_domain');
  }

  const combinedContent = [subject, body].filter(Boolean).join(' ');
  const hasSpamContent = containsSpamKeywords(
    combinedContent,
    contentThreshold,
  );
  if (hasSpamContent) {
    reasons.push('spam_content');
  }

  return {
    isSpam: reasons.length > 0,
    reasons,
    domain,
    isDisposable,
    hasSpamContent,
  };
}
