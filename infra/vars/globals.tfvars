#########################################
# Generic
#########################################
project         = "sh"
location        = "uksouth"
runtime_name    = "node"
runtime_version = "22"

maximum_instance_count = 50
instance_memory_in_mb  = 2048

default_tz          = "Europe/London"
horizon_days        = "1"
allow_drift_minutes = "1"

eventgrid_included_event_types = [
  "Microsoft.Resources.ResourceWriteSuccess",
]

eventgrid_function_name = "TagIngest"
