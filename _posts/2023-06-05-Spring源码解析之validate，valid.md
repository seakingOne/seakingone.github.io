---
layout: post
title:  "Spring源码解析之validate，valid"
date:   2023-06-05
desc: "spring 源码 校验"
keywords: "spring 源码 校验"
categories: [Article]
tags: [Java, spring]
icon: icon-html
---

## Validator

>Spring 具有一个Validator可用于验证对象的接口。该 Validator接口通过使用一个Errors对象来工作，以便在验证时，验证器可以向该Errors对象报告验证失败。
>但是由于spring的Validator原生接口与校验密切整合，所以不太合适面向bean类型的校验

比如定义基本类如下：
```sh

public class Person {

	private String name;
	private int age;

	// the usual getters and setters...
}

```
实现接口：
```sh
public class PersonValidator implements Validator {

	/**
	 * This Validator validates only Person instances
	 */
	public boolean supports(Class clazz) {
		return Person.class.equals(clazz);
	}

	public void validate(Object obj, Errors e) {
		ValidationUtils.rejectIfEmpty(e, "name", "name.empty");
		Person p = (Person) obj;
		if (p.getAge() < 0) {
			e.rejectValue("age", "negativevalue");
		} else if (p.getAge() > 110) {
			e.rejectValue("age", "too.darn.old");
		}
	}
}
```
验证错误会报告给Errors传递给验证器的对象。问题很明显，其实不太利用扩展，validate逻辑和bean本身的逻辑已经绑定在一起了。

## spring校验的救赎
>Spring Framework 提供对 Java Bean Validation API 的支持，`@Valid`用于标记入参；
>`LocalValidatorFactoryBean`:符合jsr303标准处理，可以定义国际化文案；
>`MethodValidationPostProcessor`:整合到spring中，通过aop的方式，默认切入`@Validate`注解做aop，完整方法参数的校验。

```sh
@Bean
public static LocalValidatorFactoryBean defaultValidator() {
    LocalValidatorFactoryBean factoryBean = new LocalValidatorFactoryBean();
    MessageInterpolatorFactory interpolatorFactory = new MessageInterpolatorFactory();
    factoryBean.setMessageInterpolator(interpolatorFactory.getObject());
    return factoryBean;
}

@Bean
public static MethodValidationPostProcessor methodValidationPostProcessor(Environment environment,
                                                                            @Lazy Validator validator, ObjectProvider<MethodValidationExcludeFilter> excludeFilters) {
    FilteredMethodValidationPostProcessor processor = new FilteredMethodValidationPostProcessor(excludeFilters.orderedStream());
    processor.setValidator(validator);
    return processor;
}
```

当然，在spring的整合，可以直接使用DataBinder和校验绑定，完成对于参数的处理。（比如springmvc实现Field校验）