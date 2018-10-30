<?php
echo "Starting Script";
//exec('/volume1/web/photoindex/pi.sh > /dev/null &');
echo exec('whoami');
exec('bash -c "exec nohup setsid /volume1/web/photoindex/pi.sh > /dev/null 2>&1 &"');
echo "Should run in background";
?>
