// const Ajv = require("ajv");
// const addFormats = require("ajv-formats");

// import Ajv from "ajv";
// import addFormats from "ajv-formats"
const Ajv = require("ajv").default;
const addFormats = require("ajv-formats").default;

// 初始化 AJV 并配置为 Draft 2019-09
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  $data: true,
  verbose: true,
  // 显式声明支持的词汇表
  vocabulary: [
    require("ajv/dist/vocabularies/core"),
    require("ajv/dist/vocabularies/applicator"),
    require("ajv/dist/vocabularies/format"),
    require("ajv/dist/vocabularies/validation"),
    require("ajv/dist/vocabularies/metadata"),
    require("ajv/dist/vocabularies/content")
  ]
});

// 添加格式验证（email, uri等）
addFormats(ajv);

// 亚马逊SP-API自定义关键词实现
const amazonKeywords = {
  // 产品类型特有属性
  "asinRequired": {
    type: "boolean",
    code(ctx) {
      if (ctx.schema === true) {
        return `if (!data.ASIN) { 
          ${ctx.error()}("必须包含 ASIN");
        }`;
      }
    },
    error: { message: "该产品类型要求提供 ASIN" }
  },
  
  "displayable": {
    type: "boolean",
    code(ctx) {
      if (ctx.schema === true) {
        return `if (typeof data === "string" && data.length > 100) {
          ${ctx.error()}("可展示内容长度不能超过100字符");
        }`;
      }
    },
    error: { message: "内容不符合展示要求" }
  },
  
  "amazonRecommendation": {
    type: "array",
    items: { type: "string" },
    code(ctx) {
      const recValues = ctx.schema.join('", "');
      return `if (!${JSON.stringify(ctx.schema)}.includes(data)) {
        ${ctx.error()}({ 
          message: "推荐使用亚马逊建议值: ${recValues}" 
        }); 
      }`;
    },
    error: { message: "非亚马逊推荐值" }
  },
  
  "conditionalRequire": {
    type: "array",
    items: [
      { type: "string" },  // 字段名
      { type: "string" }   // 条件表达式
    ],
    code(ctx) {
      const [field, condition] = ctx.schema;
      return `if (${condition}) {
        if (!data.${field}) {
          ${ctx.error()}({ 
            message: "当条件满足时必须提供 ${field}" 
          });
        }
      }`;
    },
    error: { message: "条件性必填字段缺失" }
  }
};

// 安全添加关键词（避免重复定义）
Object.entries(amazonKeywords).forEach(([keyword, definition]) => {
  if (!ajv.RULES.keywords[keyword]) {
    ajv.addKeyword(definition);
  } else {
    console.warn(`关键词 "${keyword}" 已存在，跳过重新定义`);
  }
});

// 创建包含亚马逊扩展的 JSON Schema
const amazonProductSchema = {
  $schema: "https://json-schema.org/draft/2019-09/schema",
  $id: "amazon-product-schema",
  $vocabulary: {
    "https://json-schema.org/draft/2019-09/vocab/core": true,
    "https://json-schema.org/draft/2019-09/vocab/applicator": true,
    "https://json-schema.org/draft/2019-09/vocab/validation": true,
    "https://developer-docs.amazon.com/sp-api/vocabularies/product-type#": true
  },
  title: "Amazon SP-API Product Schema",
  type: "object",
  properties: {
    ASIN: {
      type: "string",
      pattern: "^[A-Z0-9]{10}$",
      description: "亚马逊标准识别号"
    },
    productType: {
      type: "string",
      amazonRecommendation: ["BOOK", "ELECTRONICS", "HOME_KITCHEN"]
    },
    brand: {
      type: "string",
      minLength: 2,
      maxLength: 50
    },
    merchantSKU: {
      type: "string",
      displayable: true
    },
    marketplaceIds: {
      type: "array",
      items: { 
        type: "string", 
        pattern: "^ATVPDKIKX0DER$|^A2Q3Y263D00KWC$" 
      }
    },
    releaseDate: {
      type: "string",
      format: "date"
    }
  },
  required: ["brand", "productType"],
  asinRequired: true,
  conditionalRequire: ["merchantSKU", "data.marketplaceIds && data.marketplaceIds.length > 0"]
};

// 编译 schema
const validate = ajv.compile(amazonProductSchema);

// 测试数据
const testProducts = [
  // 有效产品
  {
    brand: "AmazonBasics",
    productType: "ELECTRONICS",
    ASIN: "B08N5WRWNW",
    marketplaceIds: ["ATVPDKIKX0DER"],
    merchantSKU: "AMZ-12345",
    releaseDate: "2023-01-15"
  },
  
  // 无效产品（多个错误）
  {
    brand: "A",  // 太短
    productType: "INVALID_TYPE",  // 不在推荐值中
    marketplaceIds: ["INVALID_MARKET", "ATVPDKIKX0DER"],
    merchantSKU: "This is a very long SKU that exceeds the displayable limit for demo purposes"  // 触发displayable
  },
  
  // 缺少必填字段
  {
    brand: "Sony",
    marketplaceIds: ["A2Q3Y263D00KWC"]
  }
];

// 批量验证测试
testProducts.forEach((product, index) => {
  console.log(`\n=== 测试产品 #${index + 1} ===`);
  console.log("产品数据:", JSON.stringify(product, null, 2));
  
  const valid = validate(product);
  
  if (valid) {
    console.log("✅ 产品数据验证通过");
  } else {
    console.error("❌ 验证失败，错误详情:");
    validate.errors.forEach(err => {
      console.log(`- ${err.instancePath || '根对象'}: ${err.message}`);
      console.log(`  关键词: ${err.keyword}, 参数: ${JSON.stringify(err.params)}`);
    });
  }
});

// 输出验证器支持的词汇表
console.log("\n验证器支持的词汇表:");
console.log(Object.keys(ajv.RULES.keywords).sort());