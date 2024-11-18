SHELL=/bin/sh

# $(t) is an optional, single test to execute
test:
	-mkdir ./tests/output
	-cargo test $(t) -- --show-output > ./tests/output/verbose.log
	@$(MAKE) test-out-sanitise
	@$(MAKE) test-out-info
	@cat ./tests/output/sanitised.log

test-out-sanitise:
	@sed '/Executable/,/Fee Summary/{/Fee Summary/!d};/Executable/d;/Fee Summary/i\ ' ./tests/output/verbose.log > ./tests/output/sanitised.log

test-out-info:
	@sed -n '/stdout/p;/Application Logs/,/Outcome/{/Application Logs/d;/Outcome/d;p}' ./tests/output/verbose.log > ./tests/output/logs.log
