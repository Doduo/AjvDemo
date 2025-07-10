import Ajv from "ajv";

var ajv = new Ajv(); // 可以传入配置项, 例如： {allErrors: true}

// ajv.addMetaSchema({
//   editable:{
//     type:Boolean,
//     Purpose:"test",
//     Descripiton: "指示是否可以修改现有项的属性值。无法修改的属性可能仍需要有效提交。",
//   }
// })

const userSchema = {
  type: "object",
  properties: {
    id: {
      type: "integer",
      minimum: 1,
      // editable:false,
    },
    name: {
      type: "string",
      minLength: 3,
      maxLength: 20,
    },
    age: {
      type: "integer",
      minimum: 18,
      maximum: 120,
    },
    roles: {
      type: "array",
      items: {
        type: "string",
        enum: ["admin", "user", "guest"],
      },
      minItems: 1,
      uniqueItems: true,
    },
    isActive: {
      type: "boolean",
    },
  },
  required: ["id", "isActive"],
  additionalProperties: false,
  allOf: [
    {
      if: {
        properties: { age: { type: "integer" } },
      },
      then: {
        required: ["name"],
      },
    },
  ],
};
// 测试数据
const validData = {
  id: 1001,
  // name: "Alice",
  roles: ["admin", "user"],
  isActive: true,
};

var validate = ajv.compile(userSchema);
var valid = validate(validData);
console.log(valid);
if (!valid) console.log(validate.errors);
