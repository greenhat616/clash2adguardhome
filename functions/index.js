export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 1. 获取 URL 参数中的 'url' (即 Clash 规则列表的地址)
  const targetUrl = url.searchParams.get('url');

  // 如果没有提供 url 参数，返回提示
  if (!targetUrl) {
    return new Response('请在 URL 后添加参数，例如：/?url=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    // 2. 请求原始的 Clash 规则列表
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare-Workers/1.0; +https://cloudflare.com)'
      }
    });

    if (!response.ok) {
      return new Response(`无法获取源文件，状态码: ${response.status}`, { status: 502 });
    }

    const text = await response.text();
    
    // 3. 处理文本，按行分割
    const lines = text.split('\n');
    const adguardRules = [];

    // 添加文件头信息
    adguardRules.push(`! Title: Cloudflare Converted List`);
    adguardRules.push(`! Original Source: ${targetUrl}`);
    adguardRules.push(`! Date: ${new Date().toISOString()}`);
    adguardRules.push(`! Description: Converted from Clash format to AdGuard Home format`);
    adguardRules.push(``);

    // 4. 遍历每一行进行转换
    for (let line of lines) {
      line = line.trim();

      // 跳过空行和注释
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }

      // domainset 格式: +.domain 或 .domain → ||domain^
      if (line.startsWith('+.') || line.startsWith('.')) {
        const domain = line.startsWith('+.') ? line.slice(2) : line.slice(1);
        if (domain) adguardRules.push(`||${domain}^`);
        continue;
      }

      // Clash 格式通常为: TYPE,VALUE,POLICY(可选)
      const parts = line.split(',');

      // 纯域名行（无逗号，无特殊前缀）视为 domainset 精确匹配
      if (parts.length === 1) {
        const domain = parts[0].trim();
        if (domain && /^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/.test(domain)) {
          adguardRules.push(`||${domain}^`);
        }
        continue;
      }

      // 确保至少有类型和值
      if (parts.length < 2) continue;

      const type = parts[0].trim().toUpperCase();
      const value = parts[1].trim();

      // 根据你的要求进行转换
      switch (type) {
        case 'DOMAIN-SUFFIX':
          // 要求: DOMAIN-SUFFIX,09mk.cn -> ||09mk.cn^
          adguardRules.push(`||${value}^`);
          break;

        case 'DOMAIN-KEYWORD':
          // 要求: DOMAIN-KEYWORD,admarvel -> ||*admarvel*^
          adguardRules.push(`||*${value}*^`);
          break;

        case 'DOMAIN':
          // 额外补充: 精确域名匹配，通常也处理为 ||domain^
          adguardRules.push(`||${value}^`);
          break;
        
        // 可以在这里添加其他类型的处理逻辑，如 IP-CIDR 等
        // 若不需要处理其他类型，则忽略
        default:
          break;
      }
    }

    // 5. 返回转换后的结果
    return new Response(adguardRules.join('\n'), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*' // 允许跨域
      }
    });

  } catch (err) {
    return new Response(`转换出错: ${err.message}`, { status: 500 });
  }
}
