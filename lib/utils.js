import { validate } from "jsvalidator";
import Vue from "vue";

let validateEmail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const validationSchema = {
	type : "object",
	schema : [
		{ name : "required", type : "boolean" },
		{ name : "email", type : "boolean" },
		{ name : "minLength", type : "number" },
		{ name : "custom", type : "function" }
	],
	allowExtraKeys : false
}

async function validateForm({ data, validation }) {
	const returnData = {
		valid : true,
		errors : []
	}
	
	for(let [name, schema] of Object.entries(validation)) {
		validate(schema, {
			...validationSchema,
			allowExtraKeys : false,
			throwOnInvalid : true
		});
		
		const val = data[name];
		
		if (schema.required === true && val === undefined) {
			// value doesn't exist and is required, fail
			returnData.errors.push({ name, message : "Field is required" });
			continue;
		}
		
		if (val === "") {
			// if the value is empty, don't run other validations
			continue;
		}

		if (schema.email === true && validateEmail.test(val) === false) {
			// value is not an email address and should an email, fail
			returnData.errors.push({ name, message : "Field does not contain a valid email." });
			continue;
		}

		if (schema.minLength && val.length < schema.minLength) {
			// value doesn't exist and is required, fail
			returnData.errors.push({ name, message : "This field does not meet the minimum length requirements." });
			continue;
		}
		
		if (schema.custom !== undefined) {
			const result = await schema.custom({ name, val, data });
			const validResult = validate(result, {
				type : "object",
				schema : [
					{ name : "valid", type : "boolean", required : true },
					{ name : "message", type : "string" },
				],
				required : true,
				allowExtraKeys : false
			});
			
			if (validResult.err) {
				console.log(`Custom validator for field '${name}' did not return the proper data`);
				throw validResult.err;
			}
			
			if (result.valid === false) {
				returnData.errors.push({ name, message : result.message });
				continue;
			}
		}
	}
	
	if (returnData.errors.length > 0) {
		returnData.valid = false;
	}
	
	return returnData;
}

function advancedPropsMixin({ schema, prop }) {
	const watch = {};
	const props = [];
	schema.forEach((val) => {
		props.push(val.name);
		watch[val.name] = function() {
			validateProps.call(this);
		}
	});
	
	const validateProps = function() {
		const valid = validate(this.$props, {
			type : "object",
			schema : schema
		});
		
		if (valid.err) {
			this[prop] = false;
			throw valid.err;
		}
		
		this[prop] = true;
	}
	
	return {
		props : props,
		data : function() {
			return {
				[prop] : false
			}
		},
		created : function() {
			validateProps.call(this);
		},
		watch : watch
	}
}

function mirrorProp(args) {
	const name = args.name;
	const defaultValue = args.default;
	const propName = `$_${name}`;
	
	return {
		data : function() {
			return {
				[propName] : this[name] !== undefined ? this[name] : defaultValue
			}
		},
		created : function() {
			this.$watch(`$data.${propName}`, (newVal) => {
				this.$emit(name, newVal);
			});
		},
		watch : {
			[name] : function(newVal) {
				this.$data[propName] = newVal;
			}
		}
	}
}

function initStateManager({ storedKeys = [], tempKeys = [] }) {
	return new Vue({
		data : function() {
			const data = {};
			storedKeys.forEach(function(name) {
				data[name] = undefined;
			});
			
			tempKeys.forEach(function(name) {
				data[name] = undefined;
			});
			
			return data;
		},
		created : function() {
			storedKeys.forEach((name) => {
				const val = localStorage.getItem(name);
				if (val !== null) {
					this[name] = val;
				}
				
				this.$watch(name, function(newVal) {
					if (newVal === undefined) {
						localStorage.removeItem(name);
					} else {
						localStorage.setItem(name, newVal);
					}
				});
			});
		}
	});
}

export {
	advancedPropsMixin,
	initStateManager,
	mirrorProp,
	validationSchema,
	validateForm
}